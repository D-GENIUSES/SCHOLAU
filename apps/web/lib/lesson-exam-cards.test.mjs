import assert from "node:assert/strict";
import test from "node:test";
import { buildExamFlashcards } from "./lesson-exam-cards.ts";

test("buildExamFlashcards maps headings, checkpoints, and recap", () => {
  const cards = buildExamFlashcards({
    lesson_id: "lesson-1",
    title: "Introduction to Philosophy",
    objective: "Define philosophy and its branches for exam answers.",
    blocks: [
      { type: "heading", text: "What is philosophy?", level: 2 },
      { type: "paragraph", text: "Philosophy is the study of fundamental questions about existence and knowledge." },
      { type: "list", items: ["Metaphysics", "Epistemology"], ordered: false },
      { type: "checkpoint", question: "Philosophy primarily deals with?", options: ["Recipes", "Fundamental questions"], correct_index: 1, explanation: "It asks why and how we know." },
      { type: "callout", tone: "tip", text: "Examiners love short definitions first, then one example." },
    ],
  });

  assert.ok(cards.length >= 4);
  assert.equal(cards[0].tag, "focus");
  assert.match(cards[0].front, /Exam focus/);
  assert.equal(cards.some((c) => c.tag === "checkpoint" && c.front.includes("Philosophy primarily")), true);
  assert.equal(cards.some((c) => c.tag === "section" && c.front.includes("Explain for exams")), true);
  assert.equal(cards.some((c) => c.tag === "recap"), true);
});

test("buildExamFlashcards returns focus card only when blocks empty", () => {
  const cards = buildExamFlashcards({
    lesson_id: "empty",
    title: "Empty lesson",
    objective: "",
    blocks: [],
  });
  assert.equal(cards.length, 1);
  assert.equal(cards[0].tag, "focus");
});
