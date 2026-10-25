import assert from "node:assert/strict";
import test from "node:test";
import { buildExamFlashcards, lessonCardText } from "./lesson-exam-cards.ts";

test("buildExamFlashcards maps lesson content without filler cards", () => {
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

  assert.equal(cards.length, 3);
  assert.equal(cards[0].tag, "focus");
  assert.equal(cards[0].front, "Introduction to Philosophy");
  assert.equal(cards.some((c) => c.tag === "checkpoint" && c.front.includes("Philosophy primarily")), true);
  assert.equal(cards.some((c) => c.tag === "section" && c.front === "What is philosophy?"), true);
  assert.equal(cards.some((c) => c.tag === "recap"), false);
});

test("buildExamFlashcards returns no generic cards when lesson content is empty", () => {
  const cards = buildExamFlashcards({
    lesson_id: "empty",
    title: "Empty lesson",
    objective: "",
    blocks: [],
  });
  assert.equal(cards.length, 0);
});

test("older saved cards use lesson wording across subjects", () => {
  assert.equal(lessonCardText("Exam focus: Differentiation"), "Differentiation");
  assert.equal(lessonCardText("Explain for exams: Philosophy"), "Philosophy");
  assert.equal(lessonCardText("In exams, focus on:\n\nDerivatives"), "Derivatives");
  assert.equal(lessonCardText("Calculate the rate of change"), "Calculate the rate of change");
});
