import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalBlocks } from "./canonical-lesson";
import { stubConceptFromUpload } from "./gemini-stub";
import { validateTeachingLessonBlocks } from "./validate-lesson";
import { parseGeminiConceptResult } from "./schemas";

test("canonical blocks match ScholAu teaching template", () => {
  const blocks = buildCanonicalBlocks({
    explanation: "A".repeat(80),
    example: "Walk through a numeric example step by step.",
    pitfall: "Do not swap the order of operations.",
    summary: "State the rule and apply it once.",
    checkpoint: {
      question: "Which step comes first?",
      options: ["Add", "Multiply", "Skip", "Guess"],
      correct_index: 1,
      explanation: "Order of operations applies.",
    },
  });
  assert.deepEqual(blocks[0], { type: "heading", level: 2, text: "Understand the idea" });
  assert.equal(validateTeachingLessonBlocks(blocks).length, 0);
});

test("stub ingestion bundle passes teaching validators", () => {
  const concept = stubConceptFromUpload({
    courseCode: "CSC 201",
    sourceSha256: "a".repeat(64),
    filename: "intro-algorithms.pdf",
    moduleTitle: "Unit 1",
    modulePosition: 1,
    lessonPosition: 1,
    battleMix: { standard: 0.3, worked_solution: 0.2, fill_in_gap: 0.5 },
  });
  assert.equal(validateTeachingLessonBlocks(concept.blocks).length, 0);
  assert.ok(concept.flashcards.length >= 2);
  assert.ok(concept.battle_questions.some((q) => q.answer_format === "fill_in_gap"));
  parseGeminiConceptResult({
    title: concept.title,
    objective: concept.objective,
    blocks: concept.blocks,
    flashcards: concept.flashcards,
    learning_questions: concept.learning_questions,
    battle_questions: concept.battle_questions,
  });
});
