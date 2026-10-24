import type { BattleMix, GeminiConceptResult } from "./types";
import { stubConceptFromUpload } from "./gemini-stub";
import { parseGeminiConceptResult } from "./schemas";
import { buildIngestionSystemPrompt } from "./prompts";
import { dedupeFlashcardsByFront } from "./normalize-gap";

export type GeminiGenerateInput = {
  courseCode: string;
  sourceSha256: string;
  filename: string;
  mimeType: string;
  moduleTitle: string;
  modulePosition: number;
  lessonPosition: number;
  battleMix: BattleMix;
  fileBytes: Buffer;
  skipLogicalKeys?: string[];
};

/** Calls Gemini when configured; otherwise uses stubConceptFromUpload. */
export async function generateConceptFromSource(input: GeminiGenerateInput): Promise<GeminiConceptResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return stubConceptFromUpload(input);
  }
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const model = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildIngestionSystemPrompt({
      courseCode: input.courseCode,
      moduleTitle: input.moduleTitle,
      filename: input.filename,
      battleMix: input.battleMix,
      skipLogicalKeys: input.skipLogicalKeys,
    });
    const response = await ai.models.generateContent({
      model,
      contents: [
        { role: "user", parts: [{ inlineData: { mimeType: input.mimeType, data: input.fileBytes.toString("base64") } }, { text: prompt }] },
      ],
      config: { responseMimeType: "application/json" },
    });
    const text = response.text?.trim();
    if (!text) throw new Error("Empty Gemini response");
    const parsed = parseGeminiConceptResult(JSON.parse(text));
    return {
      ...parsed,
      flashcards: dedupeFlashcardsByFront(parsed.flashcards),
    } as GeminiConceptResult;
  } catch {
    return stubConceptFromUpload(input);
  }
}
