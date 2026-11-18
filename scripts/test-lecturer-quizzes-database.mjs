import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createChallengeTestDatabase } from "./lib/course-challenge-test-db.mjs";

const { db, id, query, login, lecturer, students, offering, otherOffering } = await createChallengeTestDatabase();
await db.exec(`alter table public.notifications
  add column if not exists title text not null default 'ScholAu',
  add column if not exists category text not null default 'academic',
  add column if not exists expires_at timestamptz not null default (now()+interval '24 hours'),
  add column if not exists context jsonb not null default '{}'`);
await db.exec(readFileSync("supabase/migrations/20261108000100_lecturer_course_quizzes.sql", "utf8"));
await db.exec(readFileSync("supabase/migrations/20261108000200_fix_quiz_option_orders.sql", "utf8"));
await db.exec(readFileSync("supabase/migrations/20261109203000_lecturer_quiz_feedback_mode.sql", "utf8"));
await db.exec(readFileSync("supabase/migrations/20261109300000_course_quiz_notifications.sql", "utf8"));
await db.exec(readFileSync("supabase/migrations/20261110000100_shared_course_class_quizzes.sql", "utf8"));
await db.exec(readFileSync("supabase/migrations/20261110000300_quiz_results_export_roster.sql", "utf8"));
await db.exec(readFileSync("supabase/migrations/20261110000200_resolve_shared_course_enrollment.sql", "utf8"));
await db.exec(readFileSync("supabase/migrations/20261116201655_lecturer_quiz_audience.sql", "utf8"));
let checks = 0;
const rpc = async (name, args = []) => (await query(`select public.${name}($${args.map((_, i) => i + 1).join(",$")}) as value`, args))[0].value;
const eq = (a, b) => { assert.deepEqual(a, b); checks++; };
const reject = async (fn, pattern) => { await assert.rejects(fn, pattern); checks++; };

// Sibling offering of the same course/semester (e.g. Software Engineering COS 201 vs Computer Science).
const offeringMeta = (await query(
  "select course_id, university_id, level_id, semester_id, department_id from public.course_offerings where id=$1",
  [offering],
))[0];
const siblingDept = (await query(
  "select id from public.departments where university_id=$1 and id<>$2 limit 1",
  [offeringMeta.university_id, offeringMeta.department_id],
))[0]?.id;
const existingSibling = (await query(
  "select id from public.course_offerings where course_id=$1 and semester_id=$2 and department_id<>$3 and status='published' limit 1",
  [offeringMeta.course_id, offeringMeta.semester_id, offeringMeta.department_id],
))[0]?.id;
const siblingOffering = existingSibling ?? id(505);
if (siblingDept) {
  if (!existingSibling) await db.query(
    `insert into public.course_offerings(id, course_id, university_id, department_id, level_id, semester_id, status)
     values($1,$2,$3,$4,$5,$6,'published')
     on conflict do nothing`,
    [siblingOffering, offeringMeta.course_id, offeringMeta.university_id, siblingDept, offeringMeta.level_id, offeringMeta.semester_id],
  );
  const siblingStudent = id(206);
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)", [
    siblingStudent, `${siblingStudent}@example.invalid`, { display_name: "Sibling programme student" },
  ]);
  await db.query("insert into public.user_roles(user_id,role) values($1,'student') on conflict do nothing", [siblingStudent]);
  await db.query("insert into public.enrollments(user_id,offering_id) values($1,$2)", [siblingStudent, siblingOffering]);
  students.push(siblingStudent);
}

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
await login(students[0]);
eq((await rpc("list_course_quizzes_v1", [offering, 0])).items, []);
await login(lecturer.uid);
await rpc("publish_lecturer_quiz_v1", [quizId, saved.quiz.revision]);
await rpc("publish_lecturer_quiz_v1", [quizId, saved.quiz.revision]);
await login(students[3]);
eq((await rpc("list_course_quizzes_v1", [otherOffering, 0])).items, []);
await reject(() => rpc("get_course_quiz_v1", [quizId]), /FORBIDDEN/);
if (siblingDept) {
  await login(students[students.length - 1]);
  const siblingList = await rpc("list_course_quizzes_v1", [siblingOffering, 0]);
  eq(siblingList.items[0]?.id, quizId);
  const siblingNotice = (await query(
    "select context from public.notifications where event_key=$1",
    [`course-quiz:${quizId}:${students[students.length - 1]}`],
  ))[0];
  eq(siblingNotice.context.offering_id, siblingOffering);
  eq(siblingNotice.context.quiz_id, quizId);
}
await login(students[0]);
const scheduled = (await rpc("list_course_quizzes_v1", [offering, 0])).items[0];
eq([scheduled.id, scheduled.state], [quizId, "upcoming"]);
const courseTitle = (await query(
  "select c.title from public.course_offerings o join public.courses c on c.id = o.course_id where o.id = $1",
  [offering],
))[0].title;
const notice = await query(
  "select safe_target, body, title, category, expires_at, context from public.notifications where kind='course_quiz' and event_key like $1",
  [`course-quiz:${quizId}:%`],
);
assert.ok(notice.every((row) => row.safe_target === `/course-quizzes/${quizId}`));
eq(notice[0].category, "academic");
eq(notice[0].title, courseTitle);
assert.match(notice[0].body, new RegExp(`New class quiz in ${courseTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: Week 1 quiz`));
const homeNotice = notice.find((row) => row.context.offering_id === offering);
eq(homeNotice.context.quiz_id, quizId);
checks += 2;

const longQuizId = id(502);
const longOpens = new Date(Date.now() + 3 * 86_400_000).toISOString();
const longCloses = new Date(Date.now() + 5 * 86_400_000).toISOString();
const longPayload = { ...payload, title: "Late window quiz", opens_at: longOpens, closes_at: longCloses };
await login(lecturer.uid);
const longSaved = await rpc("save_lecturer_quiz_v1", [longQuizId, offering, 0, longPayload]);
await rpc("publish_lecturer_quiz_v1", [longQuizId, longSaved.quiz.revision]);

await login(students[0]);
await reject(() => rpc("start_lecturer_quiz_attempt_v1", [quizId, "MAT2024001"]), /INVALID_STATE/);
await db.exec("reset role");
await db.query("update private.lecturer_course_quizzes set opens_at = clock_timestamp() - interval '1 second' where id=$1", [quizId]);
await login(students[0]);
let detail = await rpc("get_course_quiz_v1", [quizId]);
eq(detail.quiz.state, "open");
eq(detail.questions.length, 0);
await rpc("start_lecturer_quiz_attempt_v1", [quizId, "MAT2024001"]);
detail = await rpc("get_course_quiz_v1", [quizId]);
eq(detail.questions.length, 1);
eq(detail.questions[0].correct, undefined);
assert.ok(detail.attempt.question_order.length === 1);
await db.exec("reset role");
const oo = (await query("select option_orders::text as value from private.lecturer_course_quiz_attempts where quiz_id=$1 and user_id=$2", [quizId, students[0]]))[0].value;
await login(students[0]);
assert.match(oo, /^\[\[/, "option_orders must be nested array-of-arrays");
assert.ok(detail.attempt.option_orders?.length === 1 && Array.isArray(detail.attempt.option_orders[0]));
await rpc("save_lecturer_quiz_answer_v1", [quizId, 0, detail.questions[0].options.indexOf("4"), detail.attempt.revision]);
detail = await rpc("submit_lecturer_quiz_attempt_v1", [quizId, detail.attempt.revision + 1]);
eq(detail.attempt.score, 1);
await login(lecturer.uid);
const exported = await rpc("export_lecturer_quiz_results_v1", [quizId]);
assert.ok(exported.rows.length >= 1, "export includes enrolled students");
const submittedRow = exported.rows.find((row) => row.matric_number === "MAT2024001");
eq(submittedRow?.status, "submitted");
eq(submittedRow?.score, 1);
checks += 1;
const quizHideId = id(501);
const hidePayload = { ...payload, opens_at: new Date(Date.now() - 60_000).toISOString(), title: "Score only quiz", feedback_mode: "immediate", questions: [question] };
await rpc("save_lecturer_quiz_v1", [quizHideId, offering, 0, hidePayload]);
await rpc("publish_lecturer_quiz_v1", [quizHideId, 0]);
await login(students[1]);
await rpc("start_lecturer_quiz_attempt_v1", [quizHideId, "MAT2024002"]);
detail = await rpc("get_course_quiz_v1", [quizHideId]);
await rpc("save_lecturer_quiz_answer_v1", [quizHideId, 0, detail.questions[0].options.indexOf("4"), detail.attempt.revision]);
detail = await rpc("submit_lecturer_quiz_attempt_v1", [quizHideId, detail.attempt.revision + 1]);
eq(detail.attempt.score, 1);
assert.equal(detail.questions[0].correct, undefined, "immediate mode hides correct index");

if (siblingDept) {
  const selectedId = id(508);
  const audiencePayload = { ...payload, title: "Software Engineering only", audience_mode: undefined,
    audience: { mode: "selected_programmes", offering_ids: [siblingOffering] } };
  await login(lecturer.uid);
  const options = await rpc("get_lecturer_quiz_audience_options_v1", [offering]);
  assert.ok(options.items.some(item => item.id === siblingOffering)); checks++;
  const preview = await rpc("preview_lecturer_quiz_audience_v1", [offering, audiencePayload.audience]);
  eq(preview.recipient_count, 1);
  const selected = await rpc("save_lecturer_quiz_v1", [selectedId, offering, 0, audiencePayload]);
  eq(selected.quiz.audience_mode, "selected_programmes");
  eq(selected.quiz.audience_offering_ids, [siblingOffering]);
  await db.exec("reset role");
  eq((await query("select private.quiz_audience_eligible($1,$2) eligible",[selectedId,students.at(-1)]))[0].eligible, true);
  await login(lecturer.uid);
  await reject(() => rpc("save_lecturer_quiz_v1", [selectedId, offering, selected.quiz.revision, {
    ...audiencePayload, audience: { mode: "selected_programmes", offering_ids: [] },
  }]), /VALIDATION_FAILED/);
  const selectedPublished = await rpc("publish_lecturer_quiz_v1", [selectedId, selected.quiz.revision]);
  eq(selectedPublished.quiz.audience_programmes.length, 1);
  await reject(() => rpc("save_lecturer_quiz_v1", [selectedId, offering, selected.quiz.revision, audiencePayload]), /INVALID_STATE/);
  await db.exec("reset role");
  const targetId = students.at(-1);
  const targetedNotices = await query("select user_id from public.notifications where kind='course_quiz' and context->>'quiz_id'=$1", [selectedId]);
  eq(targetedNotices.map(row => row.user_id), [targetId]);
  await db.exec("reset role");
  await db.query("update private.lecturer_course_quizzes set opens_at=clock_timestamp()-interval '1 second' where id=$1", [selectedId]);
  await login(students[0]);
  eq((await rpc("list_course_quizzes_v1", [offering, 0])).items.some(item => item.id === selectedId), false);
  await reject(() => rpc("get_course_quiz_v1", [selectedId]), /FORBIDDEN/);
  await reject(() => rpc("start_lecturer_quiz_attempt_v1", [selectedId, "MAT2024010"]), /FORBIDDEN/);
  await login(targetId);
  eq((await rpc("list_course_quizzes_v1", [siblingOffering, 0])).items.some(item => item.id === selectedId), true);
  eq((await rpc("start_lecturer_quiz_attempt_v1", [selectedId, "MAT2024010"])).quiz.id, selectedId);
  await login(lecturer.uid);
  const audienceRoster = await rpc("lecturer_quiz_roster_v1", [offering, selectedId, "", 0]);
  eq(audienceRoster.items.map(row => row.user_id), [targetId]);
  const audienceExport = await rpc("export_lecturer_quiz_results_v1", [selectedId]);
  eq(audienceExport.rows.length, 1);
}
console.log(`Lecturer quiz database: ${checks} checks passed.`);
