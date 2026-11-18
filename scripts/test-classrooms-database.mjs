import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createChallengeTestDatabase } from "./lib/course-challenge-test-db.mjs";

const { db, id, query, login, lecturer, students, offering, otherOffering } = await createChallengeTestDatabase();
let checks = 0;
const rpc = async (name, args = []) => (await query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`, args))[0].value;
const eq = (actual, expected) => { checks++; assert.deepEqual(actual, expected, `check ${checks}`); };
const reject = async (fn, pattern) => { checks++; await assert.rejects(fn, pattern, `rejection check ${checks} expected ${pattern}`); };

try {
  await db.exec(`alter table public.notifications
    add column if not exists title text not null default 'ScholAu',
    add column if not exists category text not null default 'academic',
    add column if not exists expires_at timestamptz not null default (now()+interval '24 hours'),
    add column if not exists context jsonb not null default '{}'`);
  for (const file of [
    "20261108000100_lecturer_course_quizzes.sql",
    "20261108000200_fix_quiz_option_orders.sql",
    "20261109203000_lecturer_quiz_feedback_mode.sql",
    "20261109300000_course_quiz_notifications.sql",
    "20261110000100_shared_course_class_quizzes.sql",
    "20261110000300_quiz_results_export_roster.sql",
    "20261110000200_resolve_shared_course_enrollment.sql",
    "20261116201655_lecturer_quiz_audience.sql",
    "20261117233757_lecturer_classrooms.sql",
  ]) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));

  const meta = (await query("select course_id, university_id, level_id, semester_id, department_id from public.course_offerings where id=$1", [offering]))[0];
  const existing = (await query("select id from public.course_offerings where course_id=$1 and semester_id=$2 and department_id<>$3 and status='published' limit 1", [meta.course_id, meta.semester_id, meta.department_id]))[0]?.id;
  const department = (await query("select id from public.departments where university_id=$1 and id<>$2 limit 1", [meta.university_id, meta.department_id]))[0]?.id;
  let sibling = existing;
  if (!sibling && department) {
    sibling = id(9001);
    await db.query(`insert into public.course_offerings(id,course_id,university_id,department_id,level_id,semester_id,status)
      values($1,$2,$3,$4,$5,$6,'published')`, [sibling, meta.course_id, meta.university_id, department, meta.level_id, meta.semester_id]);
  }
  const secondProgrammeStudent = id(9020);
  if (sibling) {
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)", [secondProgrammeStudent, `${secondProgrammeStudent}@example.invalid`, { display_name: "Second programme student" }]);
    await db.query("insert into public.enrollments(user_id,offering_id) values($1,$2)", [secondProgrammeStudent, sibling]);
  }

  const roomId = id(9100);
  await login(lecturer.uid);
  const room = await rpc("create_classroom_v1", [offering, "Shared course room", sibling ? [offering, sibling] : [offering]]);
  eq(room.classroom.id.length > 0, true);
  eq(room.classroom.join_open, true);
  await login(students[0]);
  await reject(() => rpc("create_classroom_v1", [offering, "Not a lecturer", [offering]]), /FORBIDDEN/);

  const classroomId = room.classroom.id;
  await login(students[3]);
  const invitation = await rpc("get_classroom_invite_v1", [classroomId]);
  eq(invitation.can_join, false);
  await login(students[0]);
  eq((await rpc("get_classroom_invite_v1", [classroomId])).can_join, true);
  await rpc("join_classroom_v1", [classroomId]);
  eq((await rpc("join_classroom_v1", [classroomId])).already_member, true);
  if (sibling) {
    await login(secondProgrammeStudent);
    eq((await rpc("get_classroom_invite_v1", [classroomId])).can_join, true);
    await rpc("join_classroom_v1", [classroomId]);
  }
  await login(students[3]);
  await reject(() => rpc("join_classroom_v1", [classroomId]), /FORBIDDEN/);

  const opens = new Date(Date.now() - 60_000).toISOString();
  const closes = new Date(Date.now() + 60 * 60_000).toISOString();
  const quizId = id(9110);
  const quizData = { title: "Room quiz", instructions: "Choose an answer.", duration_minutes: 10,
    opens_at: opens, closes_at: closes, max_attempts: 1, feedback_mode: "after_submit",
    audience: { mode: "all_programmes", offering_ids: [] },
    questions: [{ prompt: "2 + 2?", options: ["3", "4", "5", "6"], correct: 1 }] };
  await login(lecturer.uid);
  const savedQuiz = await rpc("save_classroom_lecturer_quiz_v1", [quizId, classroomId, 0, quizData]);
  eq(savedQuiz.quiz.classroom_id, classroomId);
  await rpc("publish_lecturer_quiz_v1", [quizId, savedQuiz.quiz.revision]);
  await db.exec("reset role");
  const notices = await query("select user_id from public.notifications where event_key like $1", [`course-quiz:${quizId}:%`]);
  eq(notices.some(row => row.user_id === students[1]), false);
  eq(notices.some(row => row.user_id === students[0]), true);
  if (sibling) eq(notices.some(row => row.user_id === secondProgrammeStudent), true);
  eq((await rpc("list_course_quizzes_v1", [offering, 0])).items.some(q => q.id === quizId), false);
  eq((await rpc("get_classroom_v1", [classroomId])).quizzes.some(q => q.id === quizId), true);

  await login(students[1]);
  eq((await rpc("list_course_quizzes_v1", [offering, 0])).items.some(q => q.id === quizId), false);
  await reject(() => rpc("get_course_quiz_v1", [quizId]), /FORBIDDEN/);
  await reject(() => rpc("start_lecturer_quiz_attempt_v1", [quizId, "MAT2024002"]), /FORBIDDEN/);
  await login(students[0]);
  await rpc("start_lecturer_quiz_attempt_v1", [quizId, "MAT2024001"]);
  eq((await rpc("get_course_quiz_v1", [quizId])).questions.length, 1);

  const challengeId = id(9120);
  const challengeData = { title: "Room challenge", instructions: "Answer carefully.", duration_minutes: 15,
    questions: [{ prompt: "2 + 2?", options: ["3", "4", "5", "6"], correct: 1 }] };
  await login(lecturer.uid);
  const savedChallenge = await rpc("save_classroom_course_challenge_v1", [challengeId, classroomId, 0, challengeData]);
  eq(savedChallenge.challenge.classroom_id, classroomId);
  await rpc("publish_course_challenge_v1", [challengeId, savedChallenge.challenge.revision, null]);
  eq((await rpc("list_course_challenges_v1", [offering, 0])).items.some(c => c.id === challengeId), false);
  eq((await rpc("get_classroom_v1", [classroomId])).challenges.some(c => c.id === challengeId), true);
  await db.exec("reset role");
  const challengeNotices = await query("select user_id from public.notifications where event_key like $1", [`course-challenge:${challengeId}:%`]);
  eq(challengeNotices.some(row => row.user_id === students[1]), false);
  eq(challengeNotices.some(row => row.user_id === students[0]), true);

  await login(students[1]);
  await reject(() => rpc("get_course_challenge_v1", [challengeId, null]), /FORBIDDEN/);
  await reject(() => rpc("join_course_challenge_v1", [challengeId]), /FORBIDDEN/);
  await login(students[0]);
  const challengeAttempt = await rpc("join_course_challenge_v1", [challengeId]);
  eq(challengeAttempt.questions[0].correct, undefined);

  await login(lecturer.uid);
  await rpc("set_classroom_join_open_v1", [classroomId, false]);
  await login(students[2]);
  await reject(() => rpc("join_classroom_v1", [classroomId]), /INVALID_STATE/);
  await login(students[0]);
  eq((await rpc("get_classroom_v1", [classroomId])).quizzes.some(q => q.id === quizId), true);

  await login(lecturer.uid);
  await rpc("archive_classroom_v1", [classroomId]);
  eq((await rpc("list_classrooms_v1", [true])).items.some(item => item.classroom.id === classroomId), true);
  const archivedRoom = await rpc("get_classroom_v1", [classroomId]);
  eq(archivedRoom.quizzes.some(q => q.id === quizId), true);
  const roomQuizRoster = await rpc("lecturer_quiz_roster_v1", [offering, quizId, "", 0]);
  eq(roomQuizRoster.items.some(row => row.user_id === students[0]), true);
  eq(roomQuizRoster.items.some(row => row.user_id === students[1]), false);
  const roomQuizExport = await rpc("export_lecturer_quiz_results_v1", [quizId]);
  eq(roomQuizExport.rows.some(row => row.matric_number === "MAT2024001"), true);
  eq(roomQuizExport.rows.length, archivedRoom.classroom.member_count);
  const roomChallengeRoster = await rpc("course_challenge_roster_v1", [offering, challengeId, "", 0]);
  eq(roomChallengeRoster.items.some(row => row.name === "Student 1"), true);
  eq(roomChallengeRoster.items.some(row => row.name === "Student 2"), false);
  await login(students[0]);
  await reject(() => rpc("get_classroom_v1", [classroomId]), /FORBIDDEN/);
  await reject(() => rpc("get_course_quiz_v1", [quizId]), /FORBIDDEN/);
  await reject(() => rpc("save_lecturer_quiz_answer_v1", [quizId, 0, 1, 1]), /FORBIDDEN/);
  await reject(() => rpc("submit_lecturer_quiz_attempt_v1", [quizId, 1]), /FORBIDDEN/);
  await reject(() => rpc("get_course_challenge_v1", [challengeId, null]), /FORBIDDEN/);
  await reject(() => rpc("answer_course_challenge_v1", [challengeId, 0, 1, 1]), /FORBIDDEN/);

  await db.exec("reset role");
  eq((await query("select bool_and(relrowsecurity) value from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname='private' and c.relname in ('lecturer_classrooms','lecturer_classroom_members')"))[0].value, true);
  eq((await query("select has_table_privilege('authenticated','private.lecturer_classrooms','SELECT') value"))[0].value, false);
  eq((await query("select has_function_privilege('anon','public.join_classroom_v1(uuid)','EXECUTE') value"))[0].value, false);
  console.log(JSON.stringify({ checks }));
} catch (error) {
  console.error(error.message, error.where ?? "", error.query ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
