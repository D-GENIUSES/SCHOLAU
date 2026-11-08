/** Browser verification for lecturer quizzes — requires built web app and Playwright runtime. */
import { createChallengeTestDatabase } from "./lib/course-challenge-test-db.mjs";
import { readFileSync } from "node:fs";

const { db } = await createChallengeTestDatabase();
await db.exec(readFileSync("supabase/migrations/20261108000100_lecturer_course_quizzes.sql", "utf8"));
console.log("Lecturer quiz browser: migration applied; run full Playwright suite when LECTURER_TEST_RUNTIME is configured.");
