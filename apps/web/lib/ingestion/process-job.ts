import { randomUUID } from "node:crypto";
import {
  contentFingerprint,
  estimateMinutes,
  generateConceptFromSource,
  promptHash,
  stableLogicalKey,
  type BattleMix,
  type IngestionLesson,
  type IngestionQuestion,
} from "@scholau/core";
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
};

export async function processIngestionJob(admin: SupabaseClient, job: JobRow) {
  const bytes = await getCourseMaterialBytes(job.object_key);
  await verifyCourseMaterialObject(job.object_key, bytes.length, job.sha256);
  const { data: course } = await admin.from("courses").select("code").eq("id", job.course_id).single();
  if (!course?.code) throw new Error("COURSE_NOT_FOUND");

  const moduleTitle = job.module_title?.trim() || "Understand the essentials";
  const modulePosition = job.module_position ?? 1;
  const lessonPosition = 1;
  const battleMix = job.battle_mix ?? { standard: 0.3, worked_solution: 0.3, fill_in_gap: 0.4 };

  const fingerprint = contentFingerprint(bytes.toString("utf8").slice(0, 5000));
  const sourceRef = `${job.filename} [source SHA-256 ${job.sha256}]`;
  const logicalKey = stableLogicalKey(course.code, job.sha256, 1, lessonPosition);

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
    courseCode: course.code,
    sourceSha256: job.sha256,
    filename: job.filename,
    mimeType: job.mime_type,
    moduleTitle,
    modulePosition,
    lessonPosition,
    battleMix,
    fileBytes: bytes,
    skipLogicalKeys,
  });

  const conceptQuestions: IngestionQuestion[] = [...concept.learning_questions, ...concept.battle_questions].map((q) => ({
    ...q,
    course_code: course.code,
    source_reference: q.source_reference || sourceRef,
  }));

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
  if (dedupBody.duplicate_fingerprint) {
    await admin.rpc("finish_material_ingestion_job_v1", {
      p_job_id: job.id,
      p_status: "succeeded",
      p_stats: { skipped: true, reason: "duplicate_fingerprint" },
      p_error: null,
    });
    return;
  }

  const lesson: IngestionLesson = {
    course_code: course.code,
    module_position: modulePosition,
    module_title: concept.module_title ?? moduleTitle,
    lesson_position: lessonPosition,
    title: concept.title,
    objective: concept.objective ?? "Explain this concept in your own words and apply it to a new example.",
    estimated_minutes: estimateMinutes(concept.blocks.map((b) => ("text" in b ? b.text : "")).join(" ")),
    blocks: concept.blocks,
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
  for (const q of questions) {
    await admin.rpc("service_record_ingestion_evidence_v1", {
      p_job_id: job.id,
      p_logical_key: q.logical_question_key,
      p_fingerprint: promptHash(q.prompt),
      p_source_reference: q.source_reference,
      p_source_text: q.prompt.slice(0, 500),
    });
  }

  await admin.rpc("finish_material_ingestion_job_v1", {
    p_job_id: job.id,
    p_status: "succeeded",
    p_stats: {
      new_lessons: 1,
      new_questions: questions.length,
      skipped_questions: conceptQuestions.length - questions.length,
      fingerprint,
    },
    p_error: null,
  });
}
