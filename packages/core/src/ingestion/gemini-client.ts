import type { BattleMix, GeminiConceptResult } from "./types";
import { parseGeminiConceptResult } from "./schemas";
import { buildIngestionSystemPrompt } from "./prompts";
import { briefFlashcardBack, briefFlashcardFront } from "./flashcards";
import { dedupeFlashcardsByFront } from "./normalize-gap";
import { validateIngestionBattleQuestions, validateTeachingLessonBlocks } from "./validate-lesson";

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
  lessonTitle?: string;
  segmentHint?: string;
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
      lessonTitle: input.lessonTitle,
      segmentHint: input.segmentHint,
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
    const parsed = parseGeminiConceptResult(parseGeminiJsonText(text), { courseCode: input.courseCode });
    const errors = [
      ...validateTeachingLessonBlocks(parsed.blocks, { courseCode: input.courseCode }),
      ...validateIngestionBattleQuestions(parsed.battle_questions),
    ];
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
    let flashcards = dedupeFlashcardsByFront(
      parsed.flashcards
        .map((card) => ({
          ...card,
          front: briefFlashcardFront(card.front),
          back: briefFlashcardBack(card.back),
        }))
        .filter((card) => card.front.length > 0 && card.back.length > 0),
    );
    if (!flashcards.length) {
      flashcards = [
        {
          front: briefFlashcardFront(parsed.title),
          back: briefFlashcardBack(parsed.objective ?? "Explain the main idea from this lesson."),
          tag: "focus" as const,
        },
      ].filter((card) => card.front.length > 0 && card.back.length > 0);
    }
    if (!flashcards.length) throw new Error("Source generation did not return usable flashcards.");
    return { ...parsed, flashcards } as GeminiConceptResult;
  } catch (cause) {
    throw new Error("MATERIAL_GENERATION_FAILED: no drafts were imported. Check the model configuration and retry the source.", { cause });
  }
}

/** Gemini often emits TeX like `\mu` / `\vec` which is invalid JSON; escape those backslashes. */
export function parseGeminiJsonText(text: string): unknown {
  const attempts = [
    text,
    // Escape backslashes that are not valid JSON escapes (common with TeX).
    text.replace(/\\(?!["\\/bfnrtu])/g, "\\\\"),
    // Also neutralize broken \uXXXX sequences Gemini sometimes emits mid-TeX.
    text
      .replace(/\\(?!["\\/bfnrtu])/g, "\\\\")
      .replace(/\\u(?![0-9a-fA-F]{4})/g, "\\\\u"),
  ];
  let lastError: unknown;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Invalid Gemini JSON");
}

export async function generateGeminiJson(
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_NOT_CONFIGURED");
  const { GoogleGenAI } = await import("@google/genai");
  const model = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: parts.map(p => (p.text ? { text: p.text } : { inlineData: p.inlineData! })) }],
    config: { responseMimeType: "application/json" },
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Empty Gemini response");
  return parseGeminiJsonText(text);
}
