import assert from "node:assert/strict";
import test from "node:test";
import { buildExamFlashcards, lessonCardText, MAX_LESSON_FLASHCARDS } from "./lesson-exam-cards.ts";

test("buildExamFlashcards maps lesson content into multiple compact notes", () => {
  const cards = buildExamFlashcards({
    lesson_id: "lesson-1",
    title: "Introduction to Philosophy",
    objective: "Define philosophy and its branches for exam answers.",
    blocks: [
      { type: "heading", text: "What is philosophy?", level: 2 },
      { type: "paragraph", text: "Philosophy is the study of fundamental questions about existence and knowledge." },
      { type: "list", items: ["Metaphysics", "Epistemology", "Ethics", "Logic"], ordered: false },
      { type: "heading", text: "What to remember", level: 2 },
      { type: "paragraph", text: "State a definition first, then give one concrete example in exams." },
      { type: "checkpoint", question: "Philosophy primarily deals with?", options: ["Recipes", "Fundamental questions"], correct_index: 1, explanation: "It asks why and how we know." },
      { type: "callout", tone: "tip", text: "Examiners love short definitions first, then one example." },
    ],
  });

  assert.ok(cards.length >= 5);
  assert.ok(cards.length <= MAX_LESSON_FLASHCARDS);
  assert.ok(cards.every((c) => c.back.length <= 170));
  assert.ok(cards.every((c) => c.front.length <= 96));
  assert.equal(cards.some((c) => c.tag === "tip" && c.back.includes("Examiners")), true);
  assert.equal(cards.some((c) => c.tag === "focus" && c.back.includes("Define philosophy")), true);
  assert.equal(cards.some((c) => c.tag === "section" && c.front.toLowerCase().includes("philosophy")), true);
  assert.equal(cards.some((c) => c.front.includes("primarily deals")), false);
  assert.equal(cards.some((c) => c.front.startsWith("How would you explain")), false);
  assert.equal(cards.filter((c) => c.back === "Metaphysics").length, 1);
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
