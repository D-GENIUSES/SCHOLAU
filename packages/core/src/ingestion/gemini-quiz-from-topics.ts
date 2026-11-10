import { z } from "zod";
import { generateGeminiJson } from "./gemini-client";
import {
  extractedQuizQuestionSchema,
  parseExtractedQuiz,
  type ExtractedQuiz,
} from "./gemini-quiz-extract";

export const quizTopicSourceSchema = z.object({
  lesson_id: z.string().uuid().optional(),
  module_title: z.string().min(1).max(200),
  lesson_title: z.string().min(1).max(200),
  objective: z.string().max(2000).default(""),
  text: z.string().min(1).max(12000),
});

export type QuizTopicSource = z.infer<typeof quizTopicSourceSchema>;

export const quizGenerateFromTopicsInputSchema = z.object({
  courseCode: z.string().min(1).max(64),
  sources: z.array(quizTopicSourceSchema).min(1).max(40),
  questionCount: z.number().int().min(10).max(30),
});

export type QuizGenerateFromTopicsInput = z.infer<typeof quizGenerateFromTopicsInputSchema>;

const generatedQuizSchema = z.object({
  questions: z.array(extractedQuizQuestionSchema).min(1).max(30),
});

export function buildQuizFromTopicsPrompt(input: QuizGenerateFromTopicsInput): string {
  const catalogue = input.sources
    .map((source, index) => {
      const objective = source.objective?.trim() ? ` Objective: ${source.objective.trim()}` : "";
      return [
        `### Source ${index + 1}: ${source.module_title} · ${source.lesson_title}${objective}`,
        source.text.trim(),
      ].join("\n");
    })
    .join("\n\n");

  return [
    `You write new multiple-choice quiz questions for the university course ${input.courseCode}.`,
    `Return JSON only: { "questions": [{ "prompt", "options" (2-6 strings), "correct" (0-based index), "explanation" }] }.`,
    `Create exactly ${input.questionCount} questions.`,
    "Ground every question only in the supplied lesson text. Do not invent syllabus topics that are absent.",
    "Balance coverage across the listed sources when possible.",
    "Prefer four options. Exactly one option must be correct. Explanations must be short and teaching-focused.",
    "Do not copy exam banks, checkpoints, or prior quiz wording verbatim. Write fresh stems and distractors.",
    "Avoid true/false-only stems and trick questions about metadata (page numbers, filenames).",
    "",
    "Lesson sources:",
    catalogue,
  ].join("\n");
}

export function parseGeneratedTopicQuiz(raw: unknown, questionCount: number): ExtractedQuiz {
  const parsed = generatedQuizSchema.parse(raw);
  for (const q of parsed.questions) {
    if (q.correct >= q.options.length) {
      throw new Error("VALIDATION_FAILED: correct index out of range");
    }
  }
  if (parsed.questions.length !== questionCount) {
    // Accept a near miss only if Gemini returns a usable non-empty set within ±2 and within 10–30.
    const delta = Math.abs(parsed.questions.length - questionCount);
    if (delta > 2 || parsed.questions.length < 10 || parsed.questions.length > 30) {
      throw new Error(
        `VALIDATION_FAILED: expected ${questionCount} questions, received ${parsed.questions.length}`,
      );
    }
  }
  return parseExtractedQuiz(parsed);
}

export async function generateQuizQuestionsFromTopics(
  input: QuizGenerateFromTopicsInput,
): Promise<ExtractedQuiz> {
  const validated = quizGenerateFromTopicsInputSchema.parse(input);
  const raw = await generateGeminiJson([{ text: buildQuizFromTopicsPrompt(validated) }]);
  return parseGeneratedTopicQuiz(raw, validated.questionCount);
}
