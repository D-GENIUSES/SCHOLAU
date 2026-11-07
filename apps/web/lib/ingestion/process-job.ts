import { randomUUID } from "node:crypto";
import {
  contentFingerprint,
  estimateMinutes,
  generateConceptFromSource,
  generateTopicOutlineFromSource,
  promptHash,
  stableLogicalKey,
  type BattleMix,
  type IngestionLesson,
  type IngestionQuestion,
  type TopicOutline,
} from "@scholau/core/ingestion";
import type { LessonBlock } from "@scholau/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCourseMaterialBytes, verifyCourseMaterialObject } from "@/lib/r2-storage";

type JobRow = {
  id: string;
  course_id: string;
  sha256: string;
  filename: string;
  object_key: string;
  mime_type: string;
  module_title: string | null;
  module_position: number | null;
  topic_mode: string;
  battle_mix: BattleMix;
  ingestion_scope?: string;
  module_id?: string | null;
  lesson_id?: string | null;
  merge_mode?: string;
  confirmed_outline?: TopicOutline | Record<string, unknown> | null;
  proposed_outline?: TopicOutline | Record<string, unknown> | null;
};

type LessonSlot = { position: number; title: string; lesson_id?: string };

async function loadLessonContext(
  admin: SupabaseClient,
  lessonId: string,
): Promise<{ modulePosition: number; moduleTitle: string; lessonPosition: number; lessonTitle: string; existingBlocks: LessonBlock[] }> {
  const { data: lesson, error } = await admin.from("lessons").select("id, position, module_id").eq("id", lessonId).single();
  if (error || !lesson) throw new Error("LESSON_NOT_FOUND");
  const { data: mod, error: modError } = await admin.from("modules").select("position, title").eq("id", lesson.module_id).single();
  if (modError || !mod) throw new Error("MODULE_NOT_FOUND");
  const { data: lv } = await admin
    .from("lesson_versions")
    .select("title, blocks, status")
    .eq("lesson_id", lessonId)
    .in("status", ["draft", "published"])
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    modulePosition: mod.position,
    moduleTitle: mod.title,
    lessonPosition: lesson.position,
    lessonTitle: lv?.title ?? `Lesson ${lesson.position}`,
    existingBlocks: (lv?.blocks as LessonBlock[]) ?? [],
  };
}

async function loadModuleLessonSlots(admin: SupabaseClient, moduleId: string): Promise<LessonSlot[]> {
  const { data: lessons } = await admin.from("lessons").select("id, position").eq("module_id", moduleId).order("position");
  if (!lessons?.length) return [];
  const slots: LessonSlot[] = [];
  for (const l of lessons) {
    const { data: lv } = await admin
      .from("lesson_versions")
      .select("title, version")
      .eq("lesson_id", l.id)
      .in("status", ["draft", "published"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    slots.push({
      position: l.position,
      lesson_id: l.id as string,
      title: lv?.title ?? `Lesson ${l.position}`,
    });
  }
  return slots;
}

function mergeBlocks(mode: string, existing: LessonBlock[], incoming: LessonBlock[]): LessonBlock[] {
  if (mode === "append_blocks" && existing.length) return [...existing, ...incoming];
  return incoming;
}

async function importConcept(
  admin: SupabaseClient,
  job: JobRow,
  courseCode: string,
  modulePosition: number,
  moduleTitle: string,
  lessonPosition: number,
  lessonTitle: string,
  concept: Awaited<ReturnType<typeof generateConceptFromSource>>,
  sourceRef: string,
  fingerprint: string,
  mergeMode: string,
  existingBlocks: LessonBlock[],
  logicalSeq: number,
) {
  const logicalKey = stableLogicalKey(courseCode, job.sha256, modulePosition, lessonPosition * 100 + logicalSeq);
  const conceptQuestions: IngestionQuestion[] = [...concept.learning_questions, ...concept.battle_questions].map((q) => ({
    ...q,
    course_code: courseCode,
    source_reference: q.source_reference || sourceRef,
    logical_question_key: q.logical_question_key || `${logicalKey}-q`,
  }));

  const { data: existingRows } = await admin.from("questions").select("logical_key").eq("course_id", job.course_id);
  const skipLogicalKeys = (existingRows ?? []).map((r) => r.logical_key).filter(Boolean);

  const dedup = await admin.rpc("service_check_ingestion_content_v1", {
    p_course_id: job.course_id,
    p_fingerprint: fingerprint,
    p_logical_keys: conceptQuestions.map((q) => q.logical_question_key),
  });
  if (dedup.error) throw new Error(dedup.error.message);
  const dedupBody = dedup.data as { duplicate_fingerprint?: boolean; existing_logical_keys?: string[] };
  const existingKeys = new Set(
    Array.isArray(dedupBody.existing_logical_keys) ? (dedupBody.existing_logical_keys as string[]) : [],
  );

  const blocks = mergeBlocks(mergeMode, existingBlocks, concept.blocks);
  const lesson: IngestionLesson = {
    course_code: courseCode,
    module_position: modulePosition,
    module_title: concept.module_title ?? moduleTitle,
    lesson_position: lessonPosition,
    title: lessonTitle || concept.title,
    objective: concept.objective ?? "Explain this concept in your own words and apply it to a new example.",
    estimated_minutes: estimateMinutes(blocks.map((b) => ("text" in b ? b.text : "")).join(" ")),
    blocks,
    flashcards: concept.flashcards ?? [],
    source_reference: sourceRef,
    logical_key: logicalKey,
  };

  const questions = conceptQuestions.filter((q) => !existingKeys.has(q.logical_question_key));
  const requestKey = randomUUID();
  const commit = await admin.rpc("service_ingestion_import_v1", {
    p_job_id: job.id,
    p_lessons: [lesson],
    p_questions: questions,
    p_request_key: requestKey,
  });
  if (commit.error) throw new Error(commit.error.message);

  await admin.rpc("service_record_ingestion_evidence_v1", {
    p_job_id: job.id,
    p_logical_key: logicalKey,
    p_fingerprint: fingerprint,
    p_source_reference: sourceRef,
    p_source_text: concept.blocks.map((b) => ("text" in b ? b.text : "")).join("\n").slice(0, 2000),
  });

  return { questions: questions.length, lesson };
}

async function processLegacyOrLessonJob(admin: SupabaseClient, job: JobRow, bytes: Buffer, courseCode: string) {
  let moduleTitle = job.module_title?.trim() || "Understand the essentials";
  let modulePosition = job.module_position ?? 1;
  let lessonPosition = 1;
  let lessonTitle: string | undefined;
  let existingBlocks: LessonBlock[] = [];
  const mergeMode = job.merge_mode ?? "fork_from_published";

  if (job.ingestion_scope === "lesson" && job.lesson_id) {
    const ctx = await loadLessonContext(admin, job.lesson_id);
    moduleTitle = ctx.moduleTitle;
    modulePosition = ctx.modulePosition;
    lessonPosition = ctx.lessonPosition;
    lessonTitle = ctx.lessonTitle;
    existingBlocks = ctx.existingBlocks;
  }

  const fingerprint = contentFingerprint(bytes.toString("utf8").slice(0, 5000));
  const sourceRef = `${job.filename} [source SHA-256 ${job.sha256}]`;
  const battleMix = job.battle_mix ?? { standard: 0.3, worked_solution: 0.3, fill_in_gap: 0.4 };

  const preDedup = await admin.rpc("service_check_ingestion_content_v1", {
    p_course_id: job.course_id,
    p_fingerprint: fingerprint,
    p_logical_keys: [],
  });
  if (preDedup.error) throw new Error(preDedup.error.message);
  if ((preDedup.data as { duplicate_fingerprint?: boolean }).duplicate_fingerprint) {
    await admin.rpc("finish_material_ingestion_job_v1", {
      p_job_id: job.id,
      p_status: "succeeded",
      p_stats: { skipped: true, reason: "duplicate_fingerprint" },
      p_error: null,
    });
    return;
  }

  const { data: existingRows } = await admin.from("questions").select("logical_key").eq("course_id", job.course_id);
  const skipLogicalKeys = (existingRows ?? []).map((r) => r.logical_key).filter(Boolean);

  const concept = await generateConceptFromSource({
    courseCode,
    sourceSha256: job.sha256,
    filename: job.filename,
    mimeType: job.mime_type,
    moduleTitle,
    modulePosition,
    lessonPosition,
    battleMix,
    fileBytes: bytes,
    skipLogicalKeys,
    lessonTitle,
  });

  const result = await importConcept(
    admin,
    job,
    courseCode,
    modulePosition,
    moduleTitle,
    lessonPosition,
    lessonTitle ?? concept.title,
    concept,
    sourceRef,
    fingerprint,
    mergeMode,
    existingBlocks,
    1,
  );

  await admin.rpc("finish_material_ingestion_job_v1", {
    p_job_id: job.id,
    p_status: "succeeded",
    p_stats: {
      new_lessons: 1,
      new_questions: result.questions,
      fingerprint,
      lesson_id: job.lesson_id ?? null,
    },
    p_error: null,
  });
}

async function processTopicJob(admin: SupabaseClient, job: JobRow, bytes: Buffer, courseCode: string) {
  if (!job.module_id) throw new Error("MODULE_ID_REQUIRED");
  const moduleTitle = job.module_title?.trim() || "Topic";
  const modulePosition = job.module_position ?? 1;
  const battleMix = job.battle_mix ?? { standard: 0.3, worked_solution: 0.3, fill_in_gap: 0.4 };
  const mergeMode = job.merge_mode ?? "fork_from_published";
  const sourceRef = `${job.filename} [source SHA-256 ${job.sha256}]`;

  const slots = await loadModuleLessonSlots(admin, job.module_id);
  const confirmed = job.confirmed_outline as TopicOutline | null | undefined;

  if (!confirmed?.segments?.length) {
    const outline = await generateTopicOutlineFromSource({
      courseCode,
      moduleTitle,
      filename: job.filename,
      mimeType: job.mime_type,
      fileBytes: bytes,
      lessonSlots: slots,
      battleMix,
    });
    for (const seg of outline.segments) {
      const match = slots.find((s) => s.position === seg.lesson_position);
      if (match?.lesson_id) seg.lesson_id = match.lesson_id;
    }
    await admin.rpc("finish_material_ingestion_job_v1", {
      p_job_id: job.id,
      p_status: "awaiting_outline",
      p_stats: { proposed_outline: outline, phase: "outline" },
      p_error: null,
    });
    return;
  }

  let totalQuestions = 0;
  let seq = 0;
  for (const segment of confirmed.segments) {
    seq += 1;
    const lessonPosition = segment.lesson_position;
    let existingBlocks: LessonBlock[] = [];
    const slot = slots.find((s) => s.position === lessonPosition);
    if (slot?.lesson_id) {
      const ctx = await loadLessonContext(admin, slot.lesson_id);
      existingBlocks = ctx.existingBlocks;
    }
    const fingerprint = contentFingerprint(`${job.sha256}:${lessonPosition}:${segment.source_hint}`.slice(0, 5000));
    const { data: existingRows } = await admin.from("questions").select("logical_key").eq("course_id", job.course_id);
    const skipLogicalKeys = (existingRows ?? []).map((r) => r.logical_key).filter(Boolean);

    const concept = await generateConceptFromSource({
      courseCode,
      sourceSha256: job.sha256,
      filename: job.filename,
      mimeType: job.mime_type,
      moduleTitle: confirmed.module_title ?? moduleTitle,
      modulePosition,
      lessonPosition,
      battleMix,
      fileBytes: bytes,
      skipLogicalKeys,
      lessonTitle: segment.lesson_title,
      segmentHint: segment.source_hint,
    });

    const imported = await importConcept(
      admin,
      job,
      courseCode,
      modulePosition,
      confirmed.module_title ?? moduleTitle,
      lessonPosition,
      segment.lesson_title,
      concept,
      sourceRef,
      fingerprint,
      mergeMode,
      existingBlocks,
      seq,
    );
    totalQuestions += imported.questions;
  }

  await admin.rpc("finish_material_ingestion_job_v1", {
    p_job_id: job.id,
    p_status: "succeeded",
    p_stats: {
      new_lessons: confirmed.segments.length,
      new_questions: totalQuestions,
      module_id: job.module_id,
      phase: "distribute",
    },
    p_error: null,
  });
}

export async function processIngestionJob(admin: SupabaseClient, job: JobRow) {
  const bytes = await getCourseMaterialBytes(job.object_key);
  await verifyCourseMaterialObject(job.object_key, bytes.length, job.sha256);
  const { data: course } = await admin.from("courses").select("code").eq("id", job.course_id).single();
  if (!course?.code) throw new Error("COURSE_NOT_FOUND");

  const scope = job.ingestion_scope ?? "legacy";
  if (scope === "topic") {
    await processTopicJob(admin, job, bytes, course.code);
    return;
  }
  await processLegacyOrLessonJob(admin, job, bytes, course.code);
}
