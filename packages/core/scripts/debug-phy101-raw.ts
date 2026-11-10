import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { buildIngestionSystemPrompt } from "../src/ingestion/prompts.ts";

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
const out = join(root, "imports", "phy-101", "part1-raw-gemini.json");
writeFileSync(out, text);
const j = JSON.parse(text);
console.log("saved", out);
console.log("block types:", (j.blocks ?? []).map((b: any) => b?.type));
console.log("flash tags:", (j.flashcards ?? []).map((c: any) => c?.tag));
console.log("learn[0] keys:", Object.keys(j.learning_questions?.[0] ?? {}));
console.log("learn[0] sample:", JSON.stringify(j.learning_questions?.[0]).slice(0, 400));
console.log("battle[0] keys:", Object.keys(j.battle_questions?.[0] ?? {}));
console.log("battle[0] sample:", JSON.stringify(j.battle_questions?.[0]).slice(0, 400));
