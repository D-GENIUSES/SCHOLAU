import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
export async function createChallengeTestDatabase() {
const runtime = createRequire(resolve(process.env.LECTURER_TEST_RUNTIME ?? "../.legal-test-runtime", "package.json"));
const { PGlite } = runtime("@electric-sql/pglite");
const { pgcrypto } = runtime("@electric-sql/pglite/contrib/pgcrypto");
const db = new PGlite({ extensions: { pgcrypto } });
const id = n => `86000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let checks = 0, serial = 100;
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const equal = async (sql, expected, args = []) => { assert.deepEqual((await query(sql, args))[0].value, expected); checks++; };
const fails = async (sql, args, pattern) => { await assert.rejects(db.query(sql, args), pattern); checks++; };
const admin = id(1);
async function login(uid) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.exec("set role authenticated");
}
async function application(courses, verified = true, university = "Lecturer Catalogue Test", faculty = "Science", department = "Computing") {
  await db.exec("reset role");
  const uid = id(++serial);
  const metadata = { display_name: "Lecturer Test", signup_kind: "lecturer", lecturer_application: { full_name: "Lecturer Test", university, faculty, department, position: "Lecturer", requested_courses: courses, institutional_profile_url: "", verification_note: "" } };
  await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)", [uid, `${uid}@example.invalid`, verified ? "2026-10-27T00:00:00Z" : null, metadata]);
  const row = (await query("select id from public.lecturer_applications where user_id=$1", [uid]))[0];
  return { uid, app: row.id };
}
async function plan(app) { return (await query("select private.lecturer_requested_assignment_plan($1) as value", [app]))[0].value; }
async function review(app, decision = "approved", offerings = [], revision = 1, key = id(++serial)) {
  return (await query("select public.admin_review_lecturer_application_v1($1,$2,$3,'',$4,$5,$6) as value", [app, decision, decision === "approved" ? "" : "Please update your teaching details.", offerings, revision, key]))[0].value;
}
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions; create schema realtime; create schema storage;
    create table auth.users(instance_id uuid,id uuid primary key,aud text,role text,email text,encrypted_password text,email_confirmed_at timestamptz,last_sign_in_at timestamptz,banned_until timestamptz,deleted_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb,created_at timestamptz,updated_at timestamptz,confirmation_token text,recovery_token text,email_change_token_new text,email_change text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;`);
  for (const name of readdirSync("supabase/migrations").sort()) {
    if (name > "20261016000200_lecturer_registration.sql") break;
    if (name.includes("_jobs.sql")) continue;
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  }
  await db.exec(readFileSync("supabase/migrations/20261029001400_lecturer_approval_course_assignments.sql", "utf8"));
  // Load the exact later answer-format column used by the new bank query.
  await db.exec(readFileSync("supabase/migrations/20261017000900_social_scoped_battles.sql", "utf8").match(/alter table public.question_versions add column answer_format[^;]+;/)[0]);
  await db.exec(readFileSync("supabase/migrations/20261029001500_course_challenges.sql", "utf8"));
  const fixtures = readFileSync("supabase/tests/database/55_lecturer_registration_courses.test.sql", "utf8");
  await db.exec(fixtures.slice(fixtures.indexOf("insert into public.universities"), fixtures.indexOf("select ok(")));
  const offering = (await query("select id from public.course_offerings where status='published' order by id limit 1"))[0].id;
  const otherOffering = (await query("select id from public.course_offerings where status='published' and id<>$1 limit 1",[offering]))[0].id;
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'admin@example.invalid','{}')",[admin]);
  await db.query("insert into public.user_roles(user_id,role) values($1,'admin')",[admin]);
  const lecturer = await application('LCT 101');
  await login(admin); await review(lecturer.app,'approved',[offering]);
  const students = [id(201),id(202),id(203),id(204)];
  await db.exec('reset role');
  for (const [i, uid] of students.entries()) {
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",[uid,`${uid}@example.invalid`,{display_name:`Student ${i+1}`}]);
    await db.query('insert into public.enrollments(user_id,offering_id) values($1,$2)',[uid,i===3?otherOffering:offering]);
  }
  await db.query('update public.profiles set leaderboard_visible=false where id=$1',[students[1]]);
  // Published course-bank question, with a private key and a second-course decoy.
  await db.exec('set session_replication_role=replica');
  const bankVersion=id(401), bankQuestion=id(400);
  const courseId=(await query('select course_id from public.course_offerings where id=$1',[offering]))[0].course_id;
  await db.query("insert into public.questions(id,course_id,pool,logical_key) values($1,$2,'learning','challenge-bank')",[bankQuestion,courseId]);
  await db.query("insert into public.question_versions(id,question_id,version,prompt,difficulty,usage,status,source_reference,reviewed_by,published_at) values($1,$2,1,'Bank: 1 + 1?','beginner',array['practice'],'published','test',$3,now())",[bankVersion,bankQuestion,admin]);
  for(let i=0;i<4;i++) await db.query('insert into public.question_options(id,question_version_id,label,body,position) values($1,$2,$3,$4,$5)',[id(410+i),bankVersion,String(i),String(i+1),i+1]);
  await db.query("insert into private.question_answer_keys(question_version_id,correct_option_id,explanation) values($1,$2,'One plus one equals two.')",[bankVersion,id(411)]);
  await db.exec('set session_replication_role=origin');

return { db, id, query, login, admin, lecturer, students, offering, otherOffering, bankVersion };
}
