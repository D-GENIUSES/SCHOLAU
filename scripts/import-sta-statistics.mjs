/**
 * Load the parsed STA 111/112/121 practice bank.
 * node scripts/import-sta-statistics.mjs            # validate only
 * node --env-file=apps/web/.env.local scripts/import-sta-statistics.mjs --apply
 *
 * Requires the editorial-status and topic-check migrations, an admin account,
 * and a linked Supabase CLI. Imports stay drafts until you pass --publish.
 * Questions are practice items (usage practice), never past papers.
 */
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const lessons = JSON.parse(readFileSync(new URL("../supabase/content/sta-statistics-lessons-20261101.json", import.meta.url), "utf8"));
const questions = JSON.parse(readFileSync(new URL("../supabase/content/sta-statistics-questions-20261101.json", import.meta.url), "utf8"));
const checks = JSON.parse(readFileSync(new URL("../supabase/content/sta-statistics-topic-checks-20261101.json", import.meta.url), "utf8"));
const apply = process.argv.includes("--apply");

if (lessons.length !== 84 || questions.length !== 400) {
  throw new Error(`Unexpected bank size: ${lessons.length} lessons, ${questions.length} questions`);
}
if (questions.some((row) => row.usage.some((usage) => usage !== "practice"))) {
  throw new Error("STA bank must be practice questions only");
}

const lessonPayload = lessons.map(({ editorial_status: _status, topic_slug: _topic, ...row }) => row);
const questionPayload = questions.map(({ editorial_status: _status, topic_slug: _topic, topic_title: _title, ...row }) => row);
const lessonStatus = lessons.filter((row) => row.editorial_status).map((row) => ({ source_reference: row.source_reference, editorial_status: row.editorial_status }));
const questionStatus = questions.filter((row) => row.editorial_status).map((row) => ({ logical_question_key: row.logical_question_key, editorial_status: row.editorial_status }));

console.log(`STA practice bank: ${lessons.length} lessons, ${questions.length} questions, ${checks.length} pre/post slots.`);
console.log("Corrected/flagged marks are applied to draft versions after import.");
if (!apply) {
  console.log("Dry run only. Re-run with --apply against a linked Supabase project after the migrations.");
  process.exit(0);
}

const requestKey = randomUUID();
const sql = `
do $body$
declare
  v_admin uuid;
  v_lessons jsonb := $lessons$${JSON.stringify(lessonPayload).replaceAll("$lessons$", "$ lessons $")}$lessons$::jsonb;
  v_questions jsonb := $questions$${JSON.stringify(questionPayload).replaceAll("$questions$", "$ questions $")}$questions$::jsonb;
  v_lesson_status jsonb := $lstatus$${JSON.stringify(lessonStatus)}$lstatus$::jsonb;
  v_question_status jsonb := $qstatus$${JSON.stringify(questionStatus)}$qstatus$::jsonb;
  v_checks jsonb := $checks$${JSON.stringify(checks)}$checks$::jsonb;
  v_import jsonb;
  v_item jsonb;
begin
  select user_id into v_admin from public.user_roles where role = 'admin' order by user_id limit 1;
  if v_admin is null then raise exception 'No administrator account'; end if;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);

  v_import := public.admin_import_lessons_v1(v_lessons, false, '${requestKey}'::uuid);
  if coalesce(v_import->>'valid','false') <> 'true' then raise exception 'Lesson import failed: %', v_import; end if;
  v_import := public.admin_import_questions_v1(v_questions, false, '${randomUUID()}'::uuid);
  if coalesce(v_import->>'valid','false') <> 'true' then raise exception 'Question import failed: %', v_import; end if;

  update public.lesson_versions lv
  set editorial_status = item->>'editorial_status'
  from jsonb_array_elements(v_lesson_status) item
  where lv.status = 'draft' and lv.source_reference = item->>'source_reference';

  update public.question_versions qv
  set editorial_status = item->>'editorial_status'
  from public.questions q
  join jsonb_array_elements(v_question_status) item on item->>'logical_question_key' = q.logical_key
  where qv.question_id = q.id and qv.status = 'draft';

  insert into public.topic_check_items (course_code, topic_key, topic_title, kind, position, logical_question_key)
  select item->>'course_code', item->>'topic_key', item->>'topic_title', item->>'kind', (item->>'position')::integer, item->>'logical_question_key'
  from jsonb_array_elements(v_checks) item
  on conflict (course_code, topic_key, kind, logical_question_key) do update
    set topic_title = excluded.topic_title, position = excluded.position;

  raise notice 'Drafts imported. Publish them from Admin review before students can be scored.';
end
$body$;
`;

const file = join(tmpdir(), `scholau-sta-${requestKey}.sql`);
writeFileSync(file, sql);
execSync(`npx supabase db query --linked -f "${file}"`, { stdio: "inherit" });
