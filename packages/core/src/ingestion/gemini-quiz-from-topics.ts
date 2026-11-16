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

/** Heuristic: published teaching text below this may not support 20 distinct MCQs. */
export const QUIZ_GEN_MIN_CHARS_FOR_20 = 1200;
export const QUIZ_GEN_VERY_THIN_CHARS = 300;

export function assessQuizTopicSources(
  sources: Array<Pick<QuizTopicSource, "text" | "lesson_title">>,
  questionCount: number,
): { totalChars: number; perLesson: Array<{ lesson_title: string; chars: number }>; warning: string | null } {
  const perLesson = sources.map((source) => ({
    lesson_title: source.lesson_title,
    chars: source.text.trim().length,
  }));
  const totalChars = perLesson.reduce((sum, row) => sum + row.chars, 0);
  const single = sources.length === 1;
  let warning: string | null = null;
  if (single && questionCount >= 20 && perLesson[0]!.chars < QUIZ_GEN_MIN_CHARS_FOR_20) {
    warning = `"${perLesson[0]!.lesson_title}" has about ${perLesson[0]!.chars.toLocaleString()} characters of teaching text — thin for ${questionCount} questions. Add lesson content or lower the count.`;
  } else if (perLesson.some((row) => row.chars < QUIZ_GEN_VERY_THIN_CHARS)) {
    const thin = perLesson.filter((row) => row.chars < QUIZ_GEN_VERY_THIN_CHARS).map((row) => row.lesson_title);
    warning = `${thin.join(", ")} has very little published text. Expect repetitive or shallow questions.`;
  }
  return { totalChars, perLesson, warning };
}

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

  const singleLesson = input.sources.length === 1;
  const coverageLine = singleLesson
    ? "One published lesson is supplied — it should support many distinct questions. Vary stems, subtopics, definitions, applications, and difficulty while staying strictly inside that lesson text."
    : "Balance coverage across the listed sources when possible.";

  return [
    `You write new multiple-choice quiz questions for the university course ${input.courseCode}.`,
    `Return JSON only: { "questions": [{ "prompt", "options" (2-6 strings), "correct" (0-based index), "explanation" }] }.`,
    `Create exactly ${input.questionCount} questions.`,
    "Ground every question only in the supplied lesson text. Do not invent syllabus topics that are absent.",
    coverageLine,
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
  options: { maxAttempts?: number } = {},
): Promise<ExtractedQuiz> {
  const validated = quizGenerateFromTopicsInputSchema.parse(input);
  const maxAttempts = Math.max(1, Math.min(3, options.maxAttempts ?? 2));
  let lastError: unknown = new Error("GENERATION_FAILED");

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const retryNote =
      attempt > 0
        ? `\n\nYou must return exactly ${validated.questionCount} complete questions. The previous attempt had the wrong count or failed validation.`
        : "";
    try {
      const raw = await generateGeminiJson([{ text: buildQuizFromTopicsPrompt(validated) + retryNote }]);
      return parseGeneratedTopicQuiz(raw, validated.questionCount);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("GENERATION_FAILED");
}
