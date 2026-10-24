import { z } from "zod";

const lessonBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(), text: z.string().min(1) }),
  z.object({ type: z.literal("paragraph"), text: z.string().min(1) }),
  z.object({
    type: z.literal("callout"),
    tone: z.enum(["info", "tip", "warning", "example"]).optional(),
    title: z.string().optional(),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("checkpoint"),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(6),
    correct_index: z.number().int().min(0).max(5),
    explanation: z.string().min(1),
  }),
  z.object({ type: z.literal("list"), items: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("code"), code: z.string().min(1), language: z.string().optional() }),
  z.object({ type: z.literal("image"), path: z.string().min(1), alt: z.string().min(1) }),
]);

export const ingestionFlashcardSchema = z.object({
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(520),
  tag: z.enum(["focus", "section", "tip", "checkpoint", "diagram", "recap"]).optional(),
});

const mcqOptionsSchema = z.array(z.object({ label: z.string(), body: z.string().min(1), steps: z.array(z.string()).optional() })).min(2).max(6);

const standardBattleSchema = z.object({
  course_code: z.string().optional(),
  logical_question_key: z.string().optional(),
  pool: z.literal("battle").optional(),
  usage: z.array(z.string()).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  prompt: z.string().min(1),
  explanation: z.string().min(1),
  source_reference: z.string().optional(),
  answer_format: z.literal("standard"),
  options: mcqOptionsSchema.length(4),
  correct_option: z.string(),
  battle_seconds: z.number().optional(),
  battle_reading_seconds: z.number().optional(),
});

const workedBattleSchema = standardBattleSchema.extend({
  answer_format: z.literal("worked_solution"),
  options: mcqOptionsSchema.length(4),
});

const fillGapBattleSchema = z.object({
  course_code: z.string().optional(),
  logical_question_key: z.string().optional(),
  pool: z.literal("battle").optional(),
  usage: z.array(z.string()).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  prompt: z.string().min(1),
  explanation: z.string().min(1),
  source_reference: z.string().optional(),
  answer_format: z.literal("fill_in_gap"),
  gaps: z
    .array(z.object({ index: z.number().int().optional(), accepted_answers: z.array(z.string().min(1)).min(1) }))
    .min(1),
  battle_seconds: z.number().optional(),
  battle_reading_seconds: z.number().optional(),
});

const learningQuestionSchema = z.object({
  course_code: z.string().optional(),
  logical_question_key: z.string().optional(),
  pool: z.literal("learning").optional(),
  usage: z.array(z.string()).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  prompt: z.string().min(1),
  explanation: z.string().min(1),
  source_reference: z.string().optional(),
  answer_format: z.literal("standard").optional(),
  options: mcqOptionsSchema.length(4),
  correct_option: z.string(),
});

export const geminiConceptResultSchema = z.object({
  title: z.string().min(1),
  objective: z.string().optional(),
  module_title: z.string().optional(),
  blocks: z.array(lessonBlockSchema).min(1),
  flashcards: z.array(ingestionFlashcardSchema).default([]),
  learning_questions: z.array(learningQuestionSchema).default([]),
  battle_questions: z
    .array(z.union([standardBattleSchema, workedBattleSchema, fillGapBattleSchema]))
    .default([]),
});

export type ParsedGeminiConceptResult = z.infer<typeof geminiConceptResultSchema>;

export function parseGeminiConceptResult(raw: unknown): ParsedGeminiConceptResult {
  return geminiConceptResultSchema.parse(raw);
}
