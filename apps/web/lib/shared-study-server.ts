import "server-only";

import { createHash } from "node:crypto";
import { cache } from "react";
import { z } from "zod";
import type { LessonBlock } from "@scholau/core";
import { publicCatalog, type PublicQuestion } from "@/lib/public-courses/catalog";
import { getServerSupabase } from "@/lib/supabase/server";
import type { CatalogSource, SharedStudyFeedback, SharedStudyQuestion, StudyLink, StudyShareErrorCode } from "./shared-study";

const checkpoint = z.number().int().min(1).max(10_000);
const slug = z.string().min(1).max(200);
export const sourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bank"), version: z.uuid() }),
  z.object({ kind: z.literal("checkpoint"), version: z.uuid(), checkpoint }),
  z.object({ kind: z.literal("catalog"), course: slug, topic: slug, key: slug }),
  z.object({ kind: z.literal("catalog-checkpoint"), course: slug, topic: slug, lesson: slug, checkpoint }),
]);

export type StudyLinkResult =
  | { ok: true; token: string; topic: string }
  | { ok: false; reason: StudyShareErrorCode };

type CatalogEntry = {
  token: string;
  courseCode: string;
  key: string;
  question: SharedStudyQuestion;
  correctId?: string;
  gapAnswers?: string[];
  explanation: string;
};

function sourceKey(source: CatalogSource) {
  return JSON.stringify(source.kind === "catalog"
    ? [source.kind, source.course, source.topic, source.key]
    : [source.kind, source.course, source.topic, source.lesson, source.checkpoint]);
}

export function publicQuestionInShareIndex(question: PublicQuestion) {
  if (question.editorial_status === "flagged" || !question.usage.some((value) => value === "practice" || value === "review") ||
    question.usage.some((value) => value === "mock" || value === "battle")) return false;
  const options = question.options?.map((option) => ({ id: option.label, body: option.body })) ?? [];
  const gapAnswers = question.gaps?.[0]?.accepted_answers;
  return question.answer_format === "standard"
    ? options.some((option) => option.id === question.correct_option)
    : Boolean(gapAnswers?.length);
}

function makeCatalogIndex() {
  const bySource = new Map<string, CatalogEntry>();
  const byToken = new Map<string, CatalogEntry>();
  function add(source: CatalogSource, entry: Omit<CatalogEntry, "token">) {
    const key = sourceKey(source);
    const version = createHash("sha256").update(JSON.stringify([key, entry])).digest("hex");
    const token = `c-${version}`;
    const item = { ...entry, token };
    bySource.set(key, item);
    byToken.set(token, item);
  }

  for (const course of publicCatalog.courses) {
    for (const topic of course.topics) {
      const location = { course: course.slug, topic: topic.slug };
      for (const item of topic.questions) {
        if (!publicQuestionInShareIndex(item)) continue;
        const options = item.options?.map((option) => ({ id: option.label, body: option.body })) ?? [];
        const gapAnswers = item.gaps?.[0]?.accepted_answers;
        const key = item.logical_question_key;
        add({ kind: "catalog", ...location, key }, {
          courseCode: course.code,
          key,
          question: {
            topic: topic.title,
            prompt: item.prompt,
            options,
            report: { targetType: "technical", reference: `${course.code} / ${topic.slug} / ${key}` },
          },
          correctId: item.correct_option,
          gapAnswers,
          explanation: item.explanation,
        });
      }
      for (const lesson of topic.lessons) {
        if (lesson.editorial_status === "flagged") continue;
        const checkpoints = (lesson.blocks as LessonBlock[]).filter((block) => block.type === "checkpoint");
        checkpoints.forEach((block, index) => {
          const key = `${lesson.slug} / checkpoint ${index + 1}`;
          add({ kind: "catalog-checkpoint", ...location, lesson: lesson.slug, checkpoint: index + 1 }, {
            courseCode: course.code,
            key,
            question: {
              topic: lesson.title,
              prompt: block.question,
              options: block.options.map((body, position) => ({ id: String(position), body })),
              report: { targetType: "technical", reference: `${course.code} / ${topic.slug} / ${key}` },
            },
            correctId: String(block.correct_index),
            explanation: block.explanation,
          });
        });
      }
    }
  }
  return { bySource, byToken };
}

let catalogIndex: ReturnType<typeof makeCatalogIndex> | undefined;
function getCatalogIndex() {
  return catalogIndex ??= makeCatalogIndex();
}

export function catalogShareEntry(source: CatalogSource) {
  return getCatalogIndex().bySource.get(sourceKey(source));
}

async function isCatalogEligible(supabase: Awaited<ReturnType<typeof getServerSupabase>>, entry: CatalogEntry) {
  const { data, error } = await supabase.rpc("can_share_catalog_question_v1", {
    p_course_code: entry.courseCode, p_key: entry.key, p_prompt: entry.question.prompt,
  });
  if (error) throw error;
  return data === true;
}

async function canShareBankPayload(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  source: Extract<z.infer<typeof sourceSchema>, { kind: "bank" } | { kind: "checkpoint" }>,
) {
  const { data, error } = await supabase.rpc("can_share_bank_question_v1", {
    p_kind: source.kind,
    p_version: source.version,
    p_checkpoint: source.kind === "checkpoint" ? source.checkpoint : 0,
  });
  if (error) throw error;
  return data === true;
}

export async function canShareBankVersions(versionIds: string[]) {
  const unique = [...new Set(versionIds.filter((id) => z.uuid().safeParse(id).success))];
  if (!unique.length) return {} as Record<string, boolean>;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("can_share_bank_questions_v1", { p_versions: unique });
  if (error) throw error;
  return (data ?? {}) as Record<string, boolean>;
}

export async function createStudyLink(source: z.infer<typeof sourceSchema>): Promise<StudyLinkResult> {
  const supabase = await getServerSupabase();
  if (source.kind === "catalog" || source.kind === "catalog-checkpoint") {
    const entry = catalogShareEntry(source);
    if (!entry) return { ok: false, reason: "not_shareable" };
    if (!await isCatalogEligible(supabase, entry)) return { ok: false, reason: "not_shareable" };
    return { ok: true, token: entry.token, topic: entry.question.topic };
  }
  const { data: session } = await supabase.auth.getClaims();
  if (!session?.claims.sub) return { ok: false, reason: "unauthenticated" };
  if (!await canShareBankPayload(supabase, source)) return { ok: false, reason: "not_shareable" };
  const { data, error } = await supabase.rpc("create_shared_study_link_v1", {
    p_kind: source.kind, p_version: source.version, p_checkpoint: source.kind === "checkpoint" ? source.checkpoint : 0,
  });
  if (error) throw error;
  if (!data) return { ok: false, reason: "not_enrolled" };
  const link = data as { token: string; topic: string };
  return { ok: true, token: link.token, topic: link.topic };
}

export async function resolveCatalogStudyLink(source: CatalogSource, baseUrl: string): Promise<StudyLink | null> {
  const result = await createStudyLink(source);
  if (!result.ok) return null;
  return { url: new URL(`/q/${result.token}`, baseUrl).toString(), topic: result.topic };
}

export async function catalogShareByQuestionKey(
  questions: PublicQuestion[],
  courseSlug: string,
  topicSlug: string,
  baseUrl: string,
) {
  const map: Record<string, { link?: StudyLink; shareable: boolean }> = {};
  for (const question of questions) {
    if (!publicQuestionInShareIndex(question)) {
      map[question.logical_question_key] = { shareable: false };
      continue;
    }
    const source: CatalogSource = { kind: "catalog", course: courseSlug, topic: topicSlug, key: question.logical_question_key };
    const link = await resolveCatalogStudyLink(source, baseUrl);
    map[question.logical_question_key] = { shareable: Boolean(link), link: link ?? undefined };
  }
  return map;
}

function normalizeAnswer(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

async function resolveLink(token: string, answer: string | null) {
  if (/^c-[a-f0-9]{64}$/.test(token)) {
    const entry = getCatalogIndex().byToken.get(token);
    if (!entry || !await isCatalogEligible(await getServerSupabase(), entry)) return null;
    if (answer === null) return entry.question;
    if (entry.gapAnswers) {
      return {
        correct: entry.gapAnswers.some((alias) => normalizeAnswer(alias) === normalizeAnswer(answer)),
        answer: entry.gapAnswers[0],
        explanation: entry.explanation,
      };
    }
    const correctOption = entry.question.options.find((option) => option.id === entry.correctId);
    if (!correctOption || !entry.question.options.some((option) => option.id === answer)) return null;
    return {
      correct: answer === correctOption.id,
      answer: correctOption.body,
      explanation: entry.explanation,
    };
  }
  if (!z.uuid().safeParse(token).success) return null;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("read_shared_study_link_v1", { p_token: token, p_answer: answer });
  if (error) throw error;
  return data;
}

export const getSharedStudyQuestion = cache(async (token: string) =>
  await resolveLink(token, null) as SharedStudyQuestion | null,
);

export async function answerSharedStudyQuestion(token: string, answer: string) {
  return await resolveLink(token, answer) as SharedStudyFeedback | null;
}
