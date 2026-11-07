import "server-only";

import { createHash } from "node:crypto";
import { cache } from "react";
import { z } from "zod";
import type { LessonBlock } from "@scholau/core";
import { publicCatalog } from "@/lib/public-courses/catalog";
import { getServerSupabase } from "@/lib/supabase/server";
import type { CatalogSource, SharedStudyFeedback, SharedStudyQuestion } from "./shared-study";

const checkpoint = z.number().int().min(1).max(10_000);
const slug = z.string().min(1).max(200);
export const sourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bank"), version: z.uuid() }),
  z.object({ kind: z.literal("checkpoint"), version: z.uuid(), checkpoint }),
  z.object({ kind: z.literal("catalog"), course: slug, topic: slug, key: slug }),
  z.object({ kind: z.literal("catalog-checkpoint"), course: slug, topic: slug, lesson: slug, checkpoint }),
]);

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
        if (item.editorial_status === "flagged" || !item.usage.some((value) => value === "practice" || value === "review") ||
          item.usage.some((value) => value === "mock" || value === "battle")) continue;
        const options = item.options?.map((option) => ({ id: option.label, body: option.body })) ?? [];
        const gapAnswers = item.gaps?.[0]?.accepted_answers;
        if (item.answer_format === "standard"
          ? !options.some((option) => option.id === item.correct_option)
          : !gapAnswers?.length) continue;
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

async function isCatalogEligible(supabase: Awaited<ReturnType<typeof getServerSupabase>>, entry: CatalogEntry) {
  const { data, error } = await supabase.rpc("can_share_catalog_question_v1", {
    p_course_code: entry.courseCode, p_key: entry.key, p_prompt: entry.question.prompt,
  });
  if (error) throw error;
  return data === true;
}

export async function createStudyLink(source: z.infer<typeof sourceSchema>) {
  const supabase = await getServerSupabase();
  if (source.kind === "catalog" || source.kind === "catalog-checkpoint") {
    const entry = getCatalogIndex().bySource.get(sourceKey(source));
    return entry && await isCatalogEligible(supabase, entry)
      ? { token: entry.token, topic: entry.question.topic } : null;
  }
  const { data: session } = await supabase.auth.getClaims();
  if (!session?.claims.sub) return null;
  const { data, error } = await supabase.rpc("create_shared_study_link_v1", {
    p_kind: source.kind, p_version: source.version, p_checkpoint: source.kind === "checkpoint" ? source.checkpoint : 0,
  });
  if (error) throw error;
  return data as { token: string; topic: string } | null;
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