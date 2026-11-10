import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseGeminiConceptResult } from "./schemas";

test("normalizes PHY 101 Gemini drift into a valid concept", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
  const raw = JSON.parse(readFileSync(join(root, "imports", "phy-101", "part1-raw-gemini.json"), "utf8"));
  const parsed = parseGeminiConceptResult(raw, { courseCode: "PHY 101" });
  assert.ok(parsed.blocks.some((b) => b.type === "paragraph"));
  assert.ok(parsed.blocks.some((b) => b.type === "worked_example"));
  assert.ok(parsed.blocks.filter((b) => b.type === "checkpoint").length >= 2);
  assert.ok(parsed.flashcards.length >= 1);
  assert.equal(parsed.flashcards[0]?.tag, "focus");
  assert.ok(parsed.learning_questions.length >= 1);
  assert.equal(parsed.learning_questions[0]?.options?.[0]?.label, "A");
  assert.ok(parsed.battle_questions.some((q) => q.answer_format === "standard"));
  assert.ok(parsed.battle_questions.some((q) => q.answer_format === "fill_in_gap"));
});
