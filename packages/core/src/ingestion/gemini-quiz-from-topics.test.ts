import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildQuizFromTopicsPrompt,
  parseGeneratedTopicQuiz,
  quizGenerateFromTopicsInputSchema,
} from "./gemini-quiz-from-topics";

const sources = [
  {
    module_title: "Logic",
    lesson_title: "Propositions",
    objective: "Identify propositions",
    text: "A proposition is a declarative statement that is true or false. Negation reverses truth value.",
  },
  {
    module_title: "Logic",
    lesson_title: "Connectives",
    objective: "",
    text: "Conjunction is true only when both parts are true. Disjunction is true when at least one part is true.",
  },
];

test("generation input enforces 10–30 questions and at least one source", () => {
  assert.throws(() => quizGenerateFromTopicsInputSchema.parse({
    courseCode: "CSC 203",
    sources,
    questionCount: 9,
  }));
  assert.throws(() => quizGenerateFromTopicsInputSchema.parse({
    courseCode: "CSC 203",
    sources,
    questionCount: 31,
  }));
  assert.throws(() => quizGenerateFromTopicsInputSchema.parse({
    courseCode: "CSC 203",
    sources: [],
    questionCount: 10,
  }));
  const ok = quizGenerateFromTopicsInputSchema.parse({
    courseCode: "CSC 203",
    sources,
    questionCount: 12,
  });
  assert.equal(ok.questionCount, 12);
  assert.equal(ok.sources.length, 2);
});

test("topic prompt asks for exact count and grounds in sources", () => {
  const prompt = buildQuizFromTopicsPrompt({
    courseCode: "CSC 203",
    sources,
    questionCount: 12,
  });
  assert.match(prompt, /exactly 12 questions/i);
  assert.match(prompt, /CSC 203/);
  assert.match(prompt, /Propositions/);
  assert.match(prompt, /Conjunction is true only when both parts are true/);
});

test("parseGeneratedTopicQuiz validates correct index and near-exact counts", () => {
  const questions = Array.from({ length: 12 }, (_, i) => ({
    prompt: `Question ${i + 1}?`,
    options: ["A", "B", "C", "D"],
    correct: 1,
    explanation: "Because B.",
  }));
  const exact = parseGeneratedTopicQuiz({ questions }, 12);
  assert.equal(exact.questions.length, 12);

  const near = parseGeneratedTopicQuiz({ questions: questions.slice(0, 11) }, 12);
  assert.equal(near.questions.length, 11);

  assert.throws(() => parseGeneratedTopicQuiz({
    questions: [{ prompt: "Q?", options: ["A", "B"], correct: 5 }],
  }, 10));

  assert.throws(() => parseGeneratedTopicQuiz({
    questions: questions.slice(0, 5),
  }, 12));
});
