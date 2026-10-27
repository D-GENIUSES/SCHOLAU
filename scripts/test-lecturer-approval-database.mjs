import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
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
try {
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
  const fixtures = readFileSync("supabase/tests/database/55_lecturer_registration_courses.test.sql", "utf8");
  await db.exec(fixtures.slice(fixtures.indexOf("insert into public.universities"), fixtures.indexOf("select ok(")));
  await db.exec(`insert into public.course_offerings(course_id,university_id,department_id,level_id,semester_id,status) values
    ('85000000-0000-4000-8000-000000000012','85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000004','85000000-0000-4000-8000-000000000007','85000000-0000-4000-8000-000000000010','published'),
    ('85000000-0000-4000-8000-000000000013','85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000005','85000000-0000-4000-8000-000000000006','85000000-0000-4000-8000-000000000009','published');`);
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'admin@example.invalid','{}')", [admin]);
  await db.query("insert into public.user_roles(user_id,role) values($1,'admin')", [admin]);
  const selected = await application("LCT 101 — First course\nLCT 401 — Advanced course\nLCT 101 — First course");
  let result = await plan(selected.app);
  assert.equal(result.offering_ids.length, 3); checks++;
  assert.deepEqual(result.unmatched_requests, []); checks++;
  await equal("select count(*)::int as value from public.lecturer_course_assignments where user_id=$1", 0, [selected.uid]);
  const legacy = await application("lct101\r\nLCT 401 - Previous title", true, "Lecturer Catalogue Test", "Faculty of Science", "Department of Computing");
  assert.equal((await plan(legacy.app)).offering_ids.length, 3); checks++;
  const wrongDepartment = await application("LCT 101", true, "Lecturer Catalogue Test", "Engineering", "Civil");
  assert.deepEqual((await plan(wrongDepartment.app)).offering_ids, []); checks++;
  const wrongUniversity = await application("LCT 101", true, "Unlisted University");
  assert.deepEqual((await plan(wrongUniversity.app)).offering_ids, []); checks++;
  await db.exec("update public.course_offerings set status='retired' where course_id='85000000-0000-4000-8000-000000000012'");
  assert.equal((await plan(selected.app)).offering_ids.length, 2); checks++;
  await db.exec("update public.course_offerings set status='published' where course_id='85000000-0000-4000-8000-000000000012'");
  await db.exec(`insert into public.universities(id,name,slug) values('86000000-0000-4000-8000-000000000010','Lecturer Catalogue Test','ambiguous-lecturer-test');
    insert into public.faculties(id,university_id,name) values('86000000-0000-4000-8000-000000000011','86000000-0000-4000-8000-000000000010','Science');
    insert into public.departments(id,university_id,faculty_id,name) values('86000000-0000-4000-8000-000000000012','86000000-0000-4000-8000-000000000010','86000000-0000-4000-8000-000000000011','Computing');`);
  assert.deepEqual((await plan(selected.app)).offering_ids, []); checks++;
  await db.exec(`delete from public.departments where id='86000000-0000-4000-8000-000000000012';
    delete from public.faculties where id='86000000-0000-4000-8000-000000000011';
    delete from public.universities where id='86000000-0000-4000-8000-000000000010';`);
  const mixed = await application("LCT 101 — First course\nCustom course\nLCT 301 — Draft course\nLCT 201 — Other department");
  result = await plan(mixed.app);
  assert.equal(result.offering_ids.length, 2); checks++;
  assert.deepEqual(result.unmatched_requests, ["Custom course", "LCT 201 — Other department", "LCT 301 — Draft course"]); checks++;
  await db.exec("update public.courses set active=false where code='LCT 401'");
  assert.equal((await plan(selected.app)).offering_ids.length, 2); checks++;
  await db.exec("update public.courses set active=true where code='LCT 401'");
  for (const [table, rowId] of [["universities", 1], ["faculties", 2], ["departments", 4], ["academic_periods", 8]]) {
    await db.query(`update public.${table} set active=false where id=$1`, [`85000000-0000-4000-8000-${String(rowId).padStart(12, "0")}`]);
    assert.equal((await plan(selected.app)).offering_ids.length, 0); checks++;
    await db.query(`update public.${table} set active=true where id=$1`, [`85000000-0000-4000-8000-${String(rowId).padStart(12, "0")}`]);
  }
  await login(selected.uid);
  await fails("select public.admin_get_lecturer_application_v1($1)", [selected.app], /FORBIDDEN/);
  await fails("select private.lecturer_requested_assignment_plan($1)", [selected.app], /permission denied/);
  await assert.rejects(review(selected.app), /FORBIDDEN/); checks++;
  await login(admin);
  result = (await query("select public.admin_get_lecturer_application_v1($1) as value", [selected.app]))[0].value;
  assert.equal(result.application.course_assignment_plan.offering_ids.length, 3); checks++;
  const approvalKey = id(++serial);
  result = await review(selected.app, "approved", [], 1, approvalKey);
  assert.equal(result.application.status, "approved"); checks++;
  assert.equal(result.application.assigned_offering_ids.length, 3); checks++;
  result = await review(selected.app, "approved", [], 1, approvalKey);
  assert.equal(result.application.assigned_offering_ids.length, 3); checks++;
  await assert.rejects(review(selected.app, "approved", [], 1), /STALE_REVISION/); checks++;
  await db.exec("reset role");
  await equal("select count(*)::int as value from public.lecturer_course_assignments where user_id=$1 and assigned_by=$2", 3, [selected.uid, admin]);
  await equal("select count(*)::int as value from public.user_roles where user_id=$1 and role='lecturer'", 1, [selected.uid]);
  await equal("select count(*)::int as value from private.lecturer_application_reviews where application_id=$1 and action='approved'", 1, [selected.app]);
  await equal("select count(*)::int as value from public.notifications where user_id=$1 and kind='lecturer_application'", 1, [selected.uid]);
  await login(selected.uid);
  await equal("select jsonb_array_length(public.get_my_lecturer_courses_v1()->'items') as value", 3);
  await login(admin);
  await db.exec("reset role");
  const extra = (await query("select id from public.course_offerings where course_id='85000000-0000-4000-8000-000000000013'"))[0].id;
  const withExtra = await application("LCT 101 — First course");
  await login(admin);
  result = await review(withExtra.app, "approved", [extra, extra]);
  assert.equal(result.application.assigned_offering_ids.length, 3); checks++;
  const invalid = await application("LCT 101 — First course");
  await login(admin);
  await assert.rejects(review(invalid.app, "approved", [id(999)]), /VALIDATION_FAILED/); checks++;
  await db.exec("reset role");
  await equal("select status as value from public.lecturer_applications where id=$1", "pending", [invalid.app]);
  await equal("select count(*)::int as value from public.lecturer_course_assignments where user_id=$1", 0, [invalid.uid]);
  await equal("select count(*)::int as value from public.user_roles where user_id=$1 and role='lecturer'", 0, [invalid.uid]);
  const unverified = await application("LCT 101", false);
  await login(admin);
  await assert.rejects(review(unverified.app), /FORBIDDEN/); checks++;
  for (const decision of ["rejected", "changes_requested"]) {
    const applicant = await application("LCT 101"); await login(admin); await review(applicant.app, decision);
    await db.exec("reset role");
    await equal("select count(*)::int as value from public.lecturer_course_assignments where user_id=$1", 0, [applicant.uid]);
  }
  await login(admin);
  await query("select public.admin_assign_lecturer_courses_v1($1,'{}',2,$2)", [selected.app, id(++serial)]);
  await db.exec("reset role");
  await equal("select count(*)::int as value from public.lecturer_course_assignments where user_id=$1", 0, [selected.uid]);
  await equal("select has_function_privilege('anon','public.admin_review_lecturer_application_v1(uuid,text,text,text,uuid[],integer,uuid)','execute') as value", false);
  console.log(JSON.stringify({ checks, failed: 0, atomicApproval: true, realMigrations: true }));
} finally { await db.close(); }
