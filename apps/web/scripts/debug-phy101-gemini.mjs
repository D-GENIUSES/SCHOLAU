/** Debug Gemini generation for one PHY 101 part. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const pdf = join(root, "imports", "phy-101", "PHY101-CH-part1-p1-16.pdf");
const bytes = readFileSync(pdf);
const sha = createHash("sha256").update(bytes).digest("hex");

// Import from packages/core source via built path if available
const coreCandidates = [
  join(root, "packages", "core", "dist", "ingestion", "gemini-client.js"),
  join(root, "packages", "core", "src", "ingestion", "gemini-client.ts"),
];

console.log("bytes", bytes.length, "model", process.env.GEMINI_MODEL, "key", process.env.GEMINI_API_KEY ? "set" : "missing");

const { GoogleGenAI } = await import("@google/genai");
const model = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const prompt = `You are extracting one teaching lesson for course PHY 101 from a scanned physics PDF (pages 1-16).
Return ONLY JSON with keys: title, objective, module_title, blocks (array of {type:"paragraph", text}), flashcards (array of {front, back} min 3),
learning_questions (array of MCQ with prompt, choices[4], correct_index, explanation, source_reference min 2),
battle_questions (array of objects with kind in standard|worked_solution|fill_in_gap, prompt, choices, correct_index, explanation, source_reference, logical_question_key min 3).
Use real physics content from the images. No placeholders.`;

try {
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
  console.log("OK response length", text.length);
  console.log(text.slice(0, 800));
  JSON.parse(text);
  console.log("JSON parse OK");
} catch (e) {
  console.error("FAIL:", e?.message ?? e);
  if (e?.cause) console.error("cause:", e.cause?.message ?? e.cause);
  if (e?.status) console.error("status:", e.status);
  if (e?.error) console.error("error obj:", JSON.stringify(e.error).slice(0, 1000));
  console.error(String(e?.stack ?? "").slice(0, 1500));
  process.exit(1);
}
