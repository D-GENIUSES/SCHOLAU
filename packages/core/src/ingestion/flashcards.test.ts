import assert from "node:assert/strict";
import test from "node:test";
import { briefFlashcardBack, briefFlashcardFront, briefFlashcardLabel, solutionLines } from "./flashcards";

test("flashcard topic labels stay short without forcing a question", () => {
  assert.equal(briefFlashcardLabel("Propositional logic"), "Propositional logic");
  assert.equal(briefFlashcardLabel("Exam focus: Derivatives"), "Derivatives");
  assert.ok(briefFlashcardLabel("A very long topic title that should truncate before it overwhelms a compact mobile study card on a lesson page").length <= 96);
  assert.equal(/\?$/.test(briefFlashcardLabel("Rate of change")), false);
});

test("flashcard fronts stay short", () => {
  const long = "How would you explain the complete historical development of propositional logic from Aristotle through modern symbolic systems in examination answers?";
  assert.ok(briefFlashcardFront(long).length <= 96);
  assert.match(briefFlashcardFront(long), /\?$/);
});

test("flashcard backs stay to a few short points", () => {
  const story = "A proposition is a statement that is either true or false. Students should read the entire chapter, copy the historical background, and then rewrite every example before the tutorial. The next section continues with several pages of commentary.";
  const brief = briefFlashcardBack(story);
  assert.ok(brief.length < story.length);
  assert.equal(brief.includes("historical background"), false);
  assert.match(brief, /true or false/);
  assert.ok(brief.split("\n").length <= 2);
  assert.ok(brief.length <= 170);
});

test("calculation explanations become separate steps", () => {
  const lines = solutionLines("Subtract 6 from both sides. Then divide by 2. The result is x = 6.");
  assert.equal(lines.length, 3);
  assert.deepEqual(solutionLines("Remember the definition of a proposition."), []);
});
