import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createChallengeTestDatabase } from "./lib/course-challenge-test-db.mjs";

const { db, id, query, login, lecturer, students, offering } = await createChallengeTestDatabase();
await db.exec(readFileSync("supabase/migrations/20261108000100_lecturer_course_quizzes.sql", "utf8"));
let checks = 0;
const rpc = async (name, args = []) => (await query(`select public.${name}($${args.map((_, i) => i + 1).join(",$")}) as value`, args))[0].value;
const eq = (a, b) => { assert.deepEqual(a, b); checks++; };
const reject = async (fn, pattern) => { await assert.rejects(fn, pattern); checks++; };

const quizId = id(500);
const opens = new Date(Date.now() + 60_000).toISOString();
const closes = new Date(Date.now() + 3_600_000).toISOString();
const question = { prompt: "2+2?", options: ["3", "4", "5", "6"], correct: 1 };
const payload = {
  title: "Week 1 quiz",
  instructions: "Answer all questions.",
  duration_minutes: 10,
  opens_at: opens,
  closes_at: closes,
  max_attempts: 1,
  questions: [question],
};

await login(lecturer.uid);
let saved = await rpc("save_lecturer_quiz_v1", [quizId, offering, 0, payload]);
eq(saved.quiz.state, "draft");
await reject(() => rpc("publish_lecturer_quiz_v1", [quizId, saved.quiz.revision + 1]), /STALE_REVISION/);
await rpc("publish_lecturer_quiz_v1", [quizId, saved.quiz.revision]);
await login(students[0]);
let detail = await rpc("get_course_quiz_v1", [quizId]);
eq(detail.quiz.state, "open");
eq(detail.questions.length, 0);
await rpc("start_lecturer_quiz_attempt_v1", [quizId, "MAT2024001"]);
detail = await rpc("get_course_quiz_v1", [quizId]);
eq(detail.questions.length, 1);
eq(detail.questions[0].correct, undefined);
assert.ok(detail.attempt.question_order.length === 1);
await rpc("save_lecturer_quiz_answer_v1", [quizId, 0, detail.questions[0].options.indexOf("4"), detail.attempt.revision]);
detail = await rpc("submit_lecturer_quiz_attempt_v1", [quizId, detail.attempt.revision + 1]);
eq(detail.attempt.score, 1);
await login(lecturer.uid);
const exported = await rpc("export_lecturer_quiz_results_v1", [quizId]);
eq(exported.rows.length, 1);
eq(exported.rows[0].matric_number, "MAT2024001");
console.log(`Lecturer quiz database: ${checks} checks passed.`);
