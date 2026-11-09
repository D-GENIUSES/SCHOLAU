import assert from "node:assert/strict";
import test from "node:test";
import { resolveContinueLessonId, resolveFirstLessonId } from "./continue-lesson.ts";

const modules = [
  {
    id: "m1",
    title: "One",
    position: 1,
    lessons: [
      { lesson_id: "a", position: 1, state: "completed" },
      { lesson_id: "b", position: 2, state: "started" },
      { lesson_id: "c", position: 3, state: "not_started" },
    ],
  },
  {
    id: "m2",
    title: "Two",
    position: 2,
    lessons: [{ lesson_id: "d", position: 1, state: "not_started" }],
  },
];

test("resolveContinueLessonId prefers started lesson", () => {
  assert.equal(resolveContinueLessonId(modules), "b");
});

test("resolveContinueLessonId picks first not started when none started", () => {
  const allComplete = [
    {
      id: "m1",
      title: "One",
      position: 1,
      lessons: [
        { lesson_id: "a", position: 1, state: "completed" },
        { lesson_id: "b", position: 2, state: "completed" },
      ],
    },
    {
      id: "m2",
      title: "Two",
      position: 2,
      lessons: [{ lesson_id: "c", position: 1, state: "not_started" }],
    },
  ];
  assert.equal(resolveContinueLessonId(allComplete), "c");
});

test("resolveContinueLessonId returns null when every lesson is complete", () => {
  const done = [
    {
      id: "m1",
      title: "One",
      position: 1,
      lessons: [{ lesson_id: "a", position: 1, state: "completed" }],
    },
  ];
  assert.equal(resolveContinueLessonId(done), null);
});

test("resolveFirstLessonId returns curriculum order", () => {
  assert.equal(resolveFirstLessonId(modules), "a");
});
