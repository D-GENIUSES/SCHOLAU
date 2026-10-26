import type { BattleMix, GeminiConceptResult } from "./types";
import { parseGeminiConceptResult } from "./schemas";
import { buildIngestionSystemPrompt } from "./prompts";
import { dedupeFlashcardsByFront } from "./normalize-gap";
import { validateTeachingLessonBlocks } from "./validate-lesson";

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

/** Source generation must fail visibly; test fixtures must never become course content. */
export async function generateConceptFromSource(input: GeminiGenerateInput): Promise<GeminiConceptResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED: source extraction requires a configured Gemini API key.");
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
    const errors = validateTeachingLessonBlocks(parsed.blocks);
    if (errors.length || !parsed.flashcards.length || !parsed.learning_questions.length || !parsed.battle_questions.length) {
      throw new Error("Source generation did not return a complete teaching lesson and study sets.");
    }
    const placeholders = [
      "Which statement best matches the main idea of this upload?",
      "What should you do after studying this upload?",
      "Fill in the blank: The main topic of this upload is _____.",
    ];
    if ([...parsed.learning_questions, ...parsed.battle_questions].some(q => placeholders.includes(q.prompt.trim()))) {
      throw new Error("Source generation returned placeholder questions.");
    }
    return {
      ...parsed,
      flashcards: dedupeFlashcardsByFront(parsed.flashcards),
    } as GeminiConceptResult;
  } catch (cause) {
    throw new Error("MATERIAL_GENERATION_FAILED: no drafts were imported. Check the model configuration and retry the source.", { cause });
  }
}
