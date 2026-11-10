import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { buildIngestionSystemPrompt } from "../src/ingestion/prompts.ts";
import { parseGeminiConceptResult } from "../src/ingestion/schemas.ts";
import { validateIngestionBattleQuestions, validateTeachingLessonBlocks } from "../src/ingestion/validate-lesson.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const pdf = join(root, "imports", "phy-101", "PHY101-CH-part1-p1-16.pdf");
const bytes = readFileSync(pdf);
const model = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const prompt = buildIngestionSystemPrompt({
  courseCode: "PHY 101",
  moduleTitle: "Physics — Chapters 1–4 (pages 1–16)",
  filename: "PHY101-CH-part1-p1-16.pdf",
  battleMix: { standard: 0.3, worked_solution: 0.3, fill_in_gap: 0.4 },
});

const response = await ai.models.generateContent({
  model,
  contents: [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType: "application/pdf", data: bytes.toString("base64") } },
        { text: prompt },
      ],
    },
  ],
  config: { responseMimeType: "application/json" },
});
const text = response.text?.trim() ?? "";
const raw = JSON.parse(text);
let parsed;
try {
  parsed = parseGeminiConceptResult(raw, { courseCode: "PHY 101" });
} catch (e: any) {
  console.error("PARSE FAIL", e.message?.slice?.(0, 1500) ?? e);
  process.exit(1);
}
const errors = [
  ...validateTeachingLessonBlocks(parsed.blocks, { courseCode: "PHY 101" }),
  ...validateIngestionBattleQuestions(parsed.battle_questions),
];
console.log("title", parsed.title);
console.log("counts", {
  blocks: parsed.blocks.length,
  flash: parsed.flashcards.length,
  learn: parsed.learning_questions.length,
  battle: parsed.battle_questions.length,
  checkpoints: parsed.blocks.filter((b) => b.type === "checkpoint").length,
});
console.log("validate", errors);
console.log("battle formats", parsed.battle_questions.map((q) => q.answer_format));
for (const [i, q] of parsed.battle_questions.entries()) {
  if (q.answer_format === "worked_solution") {
    const correct = q.options?.find((o) => o.label === q.correct_option);
    console.log("worked", i, "steps", correct?.steps?.length, "correct", q.correct_option);
  }
}
