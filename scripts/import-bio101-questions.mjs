/**
 * Import and publish BIO 101 chapter questions, then enlarge course assessments.
 * node --env-file=apps/web/.env.local scripts/import-bio101-questions.mjs
 */
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const questionsPath = join(root, "supabase", "content", "bio-101-chapters-1-7-questions-20261101.json");
const rows = JSON.parse(readFileSync(questionsPath, "utf8"));
if (!Array.isArray(rows) || rows.length === 0) throw new Error("Question JSON is empty");
const jsonLiteral = JSON.stringify(rows);
if (jsonLiteral.includes("$bio101q$")) throw new Error("JSON contains the dollar-quote tag");

const requestKey = randomUUID();
const sql = `
do $body$
declare
  v_admin uuid;
  v_course uuid;
  v_import jsonb;
  v_item jsonb;
  v_id uuid;
  v_learning uuid[];
  v_n integer;
  v_assessment uuid;
  v_kind text;
  v_count integer;
  v_duration integer;
  v_title text;
  v_result jsonb;
begin
  select user_id into v_admin from public.user_roles where role = 'admin' order by user_id limit 1;
  if v_admin is null then raise exception 'No administrator account'; end if;
  select id into v_course from public.courses where code = 'BIO 101';
  if v_course is null then raise exception 'BIO 101 course not found'; end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);

  v_import := public.admin_import_questions_v1($bio101q$${jsonLiteral}$bio101q$::jsonb, false, '${requestKey}'::uuid);
  if coalesce(v_import->>'valid','false') <> 'true'
     or jsonb_array_length(coalesce(v_import->'created', '[]'::jsonb)) = 0 then
    raise exception 'BIO 101 question import failed: %', v_import;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(v_import->'created', '[]'::jsonb)) loop
    v_id := (v_item->>'question_version_id')::uuid;
    perform public.admin_publish_v1('question_version', v_id, gen_random_uuid());
  end loop;

  select coalesce(array_agg(qv.id order by q.logical_key), '{}') into v_learning
  from public.question_versions qv
  join public.questions q on q.id = qv.question_id
  where q.course_id = v_course and q.pool = 'learning' and qv.status = 'published';
  v_n := coalesce(cardinality(v_learning), 0);
  if v_n < 20 then raise exception 'Expected a larger BIO 101 learning pool, got %', v_n; end if;

  foreach v_kind in array array['review','practice','mock'] loop
    if v_kind = 'review' then
      v_count := least(20, v_n); v_duration := null; v_title := 'Shared course questions: Review';
    elsif v_kind = 'practice' then
      v_count := least(25, v_n); v_duration := null; v_title := 'Shared course questions: Practice';
    else
      v_count := least(40, v_n); v_duration := v_count * 90; v_title := 'Shared course questions: Mock';
    end if;
    select a.id into v_assessment from public.assessments a where a.course_id = v_course and a.kind = v_kind order by a.id limit 1;
    v_result := public.admin_upsert_assessment_draft_v1(
      v_assessment, v_course, v_kind, v_title, null, v_count, v_duration, v_learning, gen_random_uuid());
    perform public.admin_publish_v1('assessment_version', (v_result->>'assessment_version_id')::uuid, gen_random_uuid());
  end loop;

  raise notice 'Imported % question rows; learning pool now %', jsonb_array_length(v_import->'created'), v_n;
end
$body$;

select q.pool, count(*) as published
from public.questions q
join public.courses c on c.id = q.course_id
join public.question_versions qv on qv.question_id = q.id and qv.status = 'published'
where c.code = 'BIO 101'
group by q.pool
order by q.pool;

select a.kind, av.question_count,
       (select count(*) from public.assessment_questions aq where aq.assessment_version_id = av.id) as attached
from public.assessments a
join public.courses c on c.id = a.course_id
join public.assessment_versions av on av.assessment_id = a.id and av.status = 'published'
where c.code = 'BIO 101'
order by a.kind;
`;

const sqlFile = join(tmpdir(), `scholau-bio101-q-${requestKey}.sql`);
writeFileSync(sqlFile, sql, "utf8");
try {
  execSync(`npx supabase db query --linked -f "${sqlFile}"`, { cwd: root, stdio: "inherit" });
} finally {
  unlinkSync(sqlFile);
}
console.log("BIO 101 question import finished.");
