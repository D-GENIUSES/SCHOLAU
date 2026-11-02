import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const lessons = JSON.parse(readFileSync(new URL("../supabase/content/sta-statistics-lessons-20261101.json", import.meta.url), "utf8"));
const questions = JSON.parse(readFileSync(new URL("../supabase/content/sta-statistics-questions-20261101.json", import.meta.url), "utf8"));
const skipped = JSON.parse(readFileSync(new URL("../imports/sta/skipped.json", import.meta.url), "utf8"));
const guest = JSON.parse(readFileSync(new URL("../apps/web/components/guest/university-samples.json", import.meta.url), "utf8"));
const catalog = JSON.parse(readFileSync(new URL("../apps/web/lib/public-courses/catalog.json", import.meta.url), "utf8"));

test("STA practice bank keeps the study-edition counts and citations", () => {
  assert.equal(lessons.length, 84);
  assert.equal(new Set(lessons.map((lesson) => `${lesson.course_code}/${lesson.module_position}`)).size, 42);
  assert.equal(questions.filter((question) => question.answer_format === "standard").length, 300);
  assert.equal(questions.filter((question) => question.answer_format === "fill_in_gap").length, 100);
  assert.equal(skipped.length, 0);
  assert.ok(questions.every((question) => question.usage.length === 1 && question.usage[0] === "practice"));
  assert.ok(questions.every((question) => /Source:\s*[TS]\d/.test(question.source_reference)));
  assert.ok(lessons.every((lesson) => lesson.logical_key.startsWith("sta")));
  const letters = questions.filter((question) => question.answer_format === "standard").map((question) => question.correct_option);
  const cycle = ["B", "A", "D", "C"];
  const matches = letters.filter((letter, index) => letter === cycle[index % 4]).length;
  assert.ok(matches / letters.length < 0.4, "stored MCQ key still follows the printed pattern");
});

test("guest samples add STA 111 and BIO 101 without replacing general knowledge files", () => {
  assert.equal(guest.filter((question) => question.courseCode === "STA 111").length, 10);
  assert.equal(guest.filter((question) => question.courseCode === "BIO 101").length, 10);
  const featured = catalog.courses.flatMap((course) => course.topics.filter((topic) => topic.featured).map((topic) => course.code));
  assert.deepEqual(featured.sort(), ["BIO 101", "STA 111"]);
});
