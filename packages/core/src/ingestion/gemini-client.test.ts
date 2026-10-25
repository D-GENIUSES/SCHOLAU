import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { stubConceptFromUpload } from "./gemini-stub";

let output: string | Error = "";
mock.module("@google/genai", { namedExports: {
  GoogleGenAI: class {
    models = { generateContent: async () => {
      if (output instanceof Error) throw output;
      return { text: output };
    } };
  },
} });
const { generateConceptFromSource } = await import("./gemini-client");
const input = {
  courseCode: "CSC 203", sourceSha256: "a".repeat(64), filename: "logic.txt", mimeType: "text/plain",
  moduleTitle: "Logic", modulePosition: 1, lessonPosition: 1,
  battleMix: { standard: 1, worked_solution: 0, fill_in_gap: 0 }, fileBytes: Buffer.from("A proposition is true or false."),
};
test("generation failures never turn into placeholder drafts", async () => {
  const previous = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(generateConceptFromSource(input), /GEMINI_NOT_CONFIGURED/);
    process.env.GEMINI_API_KEY = "test-only-mocked-key";
    output = new Error("provider unavailable");
    await assert.rejects(generateConceptFromSource(input), /MATERIAL_GENERATION_FAILED/);
    output = "not json";
    await assert.rejects(generateConceptFromSource(input), /MATERIAL_GENERATION_FAILED/);
    output = JSON.stringify(stubConceptFromUpload(input));
    await assert.rejects(generateConceptFromSource(input), /MATERIAL_GENERATION_FAILED/);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
