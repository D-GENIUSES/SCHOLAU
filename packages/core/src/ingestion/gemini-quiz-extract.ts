import { z } from "zod";
import { generateGeminiJson } from "./gemini-client";

export const extractedQuizQuestionSchema = z.object({
  prompt: z.string().min(1).max(2000),
  options: z.array(z.string().min(1).max(1000)).min(2).max(6),
  correct: z.number().int().min(0),
  explanation: z.string().max(4000).optional(),
});

export const extractedQuizSchema = z.object({
  questions: z.array(extractedQuizQuestionSchema).min(1).max(100),
});

export type ExtractedQuiz = z.infer<typeof extractedQuizSchema>;

export function parseExtractedQuiz(raw: unknown): ExtractedQuiz {
  const parsed = extractedQuizSchema.parse(raw);
  for (const q of parsed.questions) {
    if (q.correct >= q.options.length) {
      throw new Error("VALIDATION_FAILED: correct index out of range");
    }
  }
  return parsed;
}

export type QuizExtractInput = {
  mimeType: string;
  text?: string;
  base64?: string;
};

export function buildQuizExtractPrompt(): string {
  return [
    "You extract multiple-choice quiz questions from educational documents.",
    "Return JSON only: { \"questions\": [{ \"prompt\", \"options\" (2-6 strings), \"correct\" (0-based index), \"explanation\" (optional) }] }.",
    "Preserve question order. If an answer key exists, set correct indices. If the key is missing, set correct to 0 and keep explanation empty.",
    "Do not invent course content beyond the source.",
  ].join(" ");
}

export async function generateQuizQuestionsFromSource(input: QuizExtractInput): Promise<ExtractedQuiz> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: buildQuizExtractPrompt() },
  ];
  if (input.text?.trim()) parts.push({ text: input.text });
  else if (input.base64) parts.push({ inlineData: { mimeType: input.mimeType, data: input.base64 } });
  else throw new Error("GEMINI_INPUT: provide text or base64 document");
  const raw = await generateGeminiJson(parts);
  return parseExtractedQuiz(raw);
}
