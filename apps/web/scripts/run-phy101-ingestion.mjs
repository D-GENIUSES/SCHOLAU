/**
 * Upload PHY 101 Chapters 1–4 PDF → R2 + ingestion job + production worker.
 * node --env-file=apps/web/.env.local apps/web/scripts/run-phy101-ingestion.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const workerSecret = process.env.INGESTION_WORKER_SECRET;
const site = process.env.INGESTION_SITE_URL ?? process.env.PROD_SITE_URL ?? "https://scholau.com";
const courseCode = "PHY 101";

const pdfPath = String.raw`c:\Users\DELL\Downloads\PHY 101 CH 1-4.pdf`;
const moduleTitle = "Physics — Chapters 1–4";
const modulePosition = 1;

function sqlQuote(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function r2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) throw new Error("R2_NOT_CONFIGURED");
  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

async function putPdf(path) {
  if (!existsSync(path)) throw new Error(`Missing file: ${path}`);
  const bytes = readFileSync(path);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const objectKey = `course-materials/${sha256}.pdf`;
  const filename = path.split(/[/\\]/).pop() ?? "upload.pdf";
  const { client, bucket } = r2Client();
  console.log(`R2 put ${filename} (${bytes.length} bytes, sha=${sha256.slice(0, 12)}…)…`);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: bytes,
      ContentType: "application/pdf",
      Metadata: { sha256 },
    }),
  );
  return { bytes, sha256, objectKey, filename };
}

function runSql(sql, label) {
  const sqlFile = join(tmpdir(), `scholau-phy101-${randomUUID()}.sql`);
  writeFileSync(sqlFile, sql.trim());
  try {
    console.log(label);
    execSync(`npx supabase db query --linked -f "${sqlFile}"`, { cwd: root, stdio: "inherit" });
  } finally {
    unlinkSync(sqlFile);
  }
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: course, error: courseErr } = await admin.from("courses").select("id, code, title").eq("code", courseCode).maybeSingle();
if (courseErr || !course) throw new Error(`Course ${courseCode} not found: ${courseErr?.message ?? "missing"}`);

const { data: offering, error: offErr } = await admin
  .from("course_offerings")
  .select("id, status")
  .eq("course_id", course.id)
  .eq("status", "published")
  .order("id", { ascending: true })
  .limit(1)
  .maybeSingle();
if (offErr || !offering) throw new Error(`No published offering for ${courseCode}: ${offErr?.message ?? "missing"}`);

const { data: adminRow } = await admin.from("user_roles").select("user_id").eq("role", "admin").limit(1).single();
if (!adminRow?.user_id) throw new Error("No admin user");

console.log(`Course: ${course.code} — ${course.title}`);
console.log(`Offering: ${offering.id}`);
console.log(`Worker site: ${site}\n`);

const { bytes, sha256, objectKey, filename } = await putPdf(pdfPath);
const jobId = randomUUID();

runSql(
  `
insert into private.course_materials (course_id, sha256, object_key, filename, bytes, published)
values ('${course.id}', '${sha256}', '${objectKey}', ${sqlQuote(filename)}, ${bytes.length}, false)
on conflict (course_id, sha256) do update set object_key = excluded.object_key, filename = excluded.filename, bytes = excluded.bytes, updated_at = now();
insert into private.material_ingestion_jobs (
  id, offering_id, course_id, uploaded_by, sha256, filename, object_key, bytes, mime_type,
  topic_mode, module_title, module_position, status, force_reprocess
) values (
  '${jobId}', '${offering.id}', '${course.id}', '${adminRow.user_id}', '${sha256}', ${sqlQuote(filename)}, '${objectKey}',
  ${bytes.length}, 'application/pdf', 'new_module', ${sqlQuote(moduleTitle)}, ${modulePosition}, 'pending', true
);
`,
  `Queued job ${jobId}`,
);

function readJobStatus() {
  const out = execSync(
    `npx supabase db query --linked -o json "select status, error, stats from private.material_ingestion_jobs where id = '${jobId}'"`,
    { cwd: root, encoding: "utf8" },
  );
  try {
    const parsed = JSON.parse(out);
    const row = Array.isArray(parsed) ? parsed[0] : parsed?.rows?.[0] ?? parsed?.[0] ?? parsed;
    return row ?? null;
  } catch {
    // CLI sometimes wraps JSON; fall back to scanning
    const m = out.match(/"status"\s*:\s*"([^"]+)"/);
    return m ? { status: m[1], raw: out.slice(0, 500) } : { status: "unknown", raw: out.slice(0, 500) };
  }
}

console.log("\nRunning worker until job finishes (PDF is large; Gemini may take several minutes)…");
let finalStatus = null;
for (let pass = 0; pass < 40; pass++) {
  const res = await fetch(`${site}/api/material-ingestion/worker`, {
    method: "POST",
    headers: { "x-ingestion-worker-secret": workerSecret ?? "" },
  });
  const body = await res.json().catch(() => ({}));
  console.log(`  worker pass ${pass + 1}: HTTP ${res.status}`, JSON.stringify(body).slice(0, 400));

  let jobRow = null;
  try {
    jobRow = readJobStatus();
  } catch (e) {
    console.log(`  status query failed: ${e.message}`);
  }
  const status = jobRow?.status;
  if (status) console.log(`  job status: ${status}`);
  if (status === "succeeded" || status === "failed" || status === "awaiting_outline") {
    finalStatus = { status, stats: jobRow?.stats, error: jobRow?.error };
    break;
  }
  await new Promise((r) => setTimeout(r, 15000));
}

if (!finalStatus) {
  console.error(`Timed out waiting for job ${jobId}`);
  process.exit(1);
}

console.log("\nFinal:", JSON.stringify(finalStatus, null, 2));
console.log(`Job id: ${jobId}`);
console.log(`Review: ${site}/admin/review`);

if (finalStatus.status === "failed") process.exit(1);
if (finalStatus.status === "awaiting_outline") {
  console.log("Job awaiting outline confirmation — confirm in UI or via confirm_material_ingestion_outline_v1");
  process.exit(2);
}

// Publish draft lesson + question versions created for this course (newest drafts under the module title)
console.log("\nPublishing PHY 101 draft lessons and questions…");
runSql(
  `
do $body$
declare
  v_admin uuid;
  v_course uuid;
  v_id uuid;
  v_n int := 0;
begin
  select user_id into v_admin from public.user_roles where role = 'admin' order by user_id limit 1;
  if v_admin is null then raise exception 'No administrator account'; end if;
  select id into v_course from public.courses where code = 'PHY 101';
  if v_course is null then raise exception 'PHY 101 course not found'; end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);

  update private.course_materials
     set published = true, updated_at = now()
   where course_id = v_course and sha256 = '${sha256}';

  for v_id in
    select lv.id
    from public.lesson_versions lv
    join public.lessons l on l.id = lv.lesson_id
    join public.modules m on m.id = l.module_id
    where l.course_id = v_course
      and lv.status = 'draft'
      and m.title = ${sqlQuote(moduleTitle)}
    order by m.position, l.position, lv.version
  loop
    perform public.admin_publish_v1('lesson_version', v_id, gen_random_uuid());
    v_n := v_n + 1;
  end loop;
  raise notice 'Published % lesson drafts', v_n;

  v_n := 0;
  for v_id in
    select qv.id
    from public.question_versions qv
    join public.questions q on q.id = qv.question_id
    where q.course_id = v_course
      and qv.status = 'draft'
      and qv.created_at > now() - interval '6 hours'
    order by qv.created_at
  loop
    perform public.admin_publish_v1('question_version', v_id, gen_random_uuid());
    v_n := v_n + 1;
  end loop;
  raise notice 'Published % question drafts', v_n;
end
$body$;

select m.position as module_position, m.title as module_title, l.position as lesson_position,
       lv.title, lv.status
from public.lesson_versions lv
join public.lessons l on l.id = lv.lesson_id
join public.modules m on m.id = l.module_id
join public.courses c on c.id = l.course_id
where c.code = 'PHY 101' and lv.status = 'published' and m.title = ${sqlQuote(moduleTitle)}
order by m.position, l.position;
`,
  "Publish drafts",
);

console.log("\nOK — PHY 101 Chapters 1–4 ingested and published.");
