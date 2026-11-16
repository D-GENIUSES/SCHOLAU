import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessQuizTopicSources,
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

test("assessQuizTopicSources flags thin lessons before large batches", () => {
  const short = assessQuizTopicSources(
    [{ lesson_title: "Intro", text: "x".repeat(400), module_title: "M", objective: "" }],
    20,
  );
  assert.ok(short.warning);
  const healthy = assessQuizTopicSources(
    [{ lesson_title: "Intro", text: "x".repeat(2000), module_title: "M", objective: "" }],
    20,
  );
  assert.equal(healthy.warning, null);
});

test("single-lesson prompt encourages depth for larger sets", () => {
  const prompt = buildQuizFromTopicsPrompt({
    courseCode: "CSC 203",
    sources: [sources[0]!],
    questionCount: 20,
  });
  assert.match(prompt, /Vary stems, subtopics/);
  assert.doesNotMatch(prompt, /Balance coverage across the listed sources/);
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
