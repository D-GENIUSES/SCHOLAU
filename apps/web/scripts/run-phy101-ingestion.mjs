/**
 * Upload split PHY 101 Chapters 1–4 PDFs → R2 + ingestion jobs + production worker + publish.
 * Source PDF is image-only (~31MB); parts under imports/phy-101/ are compressed page slices.
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
const moduleTitlePrefix = "Physics — Chapters 1–4";

const files = [
  {
    path: join(root, "imports", "phy-101", "PHY101-CH-part1-p1-16.pdf"),
    moduleTitle: `${moduleTitlePrefix} (pages 1–16)`,
    position: 1,
  },
  {
    path: join(root, "imports", "phy-101", "PHY101-CH-part2-p17-33.pdf"),
    moduleTitle: `${moduleTitlePrefix} (pages 17–33)`,
    position: 2,
  },
  {
    path: join(root, "imports", "phy-101", "PHY101-CH-part3-p34-50.pdf"),
    moduleTitle: `${moduleTitlePrefix} (pages 34–50)`,
    position: 3,
  },
  {
    path: join(root, "imports", "phy-101", "PHY101-CH-part4-p51-67.pdf"),
    moduleTitle: `${moduleTitlePrefix} (pages 51–67)`,
    position: 4,
  },
];

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
  console.log(`R2 put ${filename} (${bytes.length} bytes)…`);
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

function readJobStatus(jobId) {
  const out = execSync(
    `npx supabase db query --linked -o json "select status, error, stats from private.material_ingestion_jobs where id = '${jobId}'"`,
    { cwd: root, encoding: "utf8" },
  );
  try {
    const parsed = JSON.parse(out);
    if (Array.isArray(parsed)) return parsed[0] ?? null;
    if (parsed?.rows?.[0]) return parsed.rows[0];
    return parsed;
  } catch {
    const m = out.match(/"status"\s*:\s*"([^"]+)"/);
    return m ? { status: m[1], raw: out.slice(0, 800) } : { status: "unknown", raw: out.slice(0, 800) };
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

const jobs = [];
for (const spec of files) {
  const { bytes, sha256, objectKey, filename } = await putPdf(spec.path);
  const jobId = randomUUID();
  jobs.push({ jobId, sha256, moduleTitle: spec.moduleTitle });
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
  ${bytes.length}, 'application/pdf', 'new_module', ${sqlQuote(spec.moduleTitle)}, ${spec.position}, 'pending', true
);
`,
    `Queued ${filename} → ${jobId}`,
  );
}

console.log("\nProcessing jobs (scanned pages; each Gemini call may take a few minutes)…");
const pending = new Set(jobs.map((j) => j.jobId));
const finals = new Map();

for (let pass = 0; pass < 80 && pending.size; pass++) {
  const res = await fetch(`${site}/api/material-ingestion/worker`, {
    method: "POST",
    headers: { "x-ingestion-worker-secret": workerSecret ?? "" },
  });
  const body = await res.json().catch(() => ({}));
  console.log(`  worker pass ${pass + 1}: HTTP ${res.status}`, JSON.stringify(body).slice(0, 500));

  for (const jobId of [...pending]) {
    let row = null;
    try {
      row = readJobStatus(jobId);
    } catch (e) {
      console.log(`  status query failed for ${jobId}: ${e.message}`);
      continue;
    }
    const status = row?.status;
    if (status === "succeeded" || status === "failed" || status === "awaiting_outline") {
      finals.set(jobId, { status, stats: row?.stats, error: row?.error });
      pending.delete(jobId);
      console.log(`  job ${jobId} → ${status}${row?.error ? `: ${row.error}` : ""}`);
    }
  }
  if (pending.size) await new Promise((r) => setTimeout(r, 20000));
}

if (pending.size) {
  console.error("Timed out; still pending:", [...pending].join(", "));
  process.exit(1);
}

const failed = [...finals.entries()].filter(([, v]) => v.status === "failed");
const awaiting = [...finals.entries()].filter(([, v]) => v.status === "awaiting_outline");
console.log("\nResults:");
for (const [id, v] of finals) console.log(`  ${id}: ${v.status}`, v.error ?? JSON.stringify(v.stats ?? {}));

if (awaiting.length) {
  console.log("Some jobs awaiting outline — confirm in UI.");
  process.exit(2);
}
if (failed.length === jobs.length) {
  console.error("All jobs failed.");
  process.exit(1);
}

const okJobs = jobs.filter((j) => finals.get(j.jobId)?.status === "succeeded");
if (!okJobs.length) {
  console.error("No succeeded jobs to publish.");
  process.exit(1);
}

const titleList = okJobs.map((j) => sqlQuote(j.moduleTitle)).join(", ");
const shaList = okJobs.map((j) => sqlQuote(j.sha256)).join(", ");

console.log("\nPublishing succeeded PHY 101 drafts…");
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
   where course_id = v_course and sha256 in (${shaList});

  for v_id in
    select lv.id
    from public.lesson_versions lv
    join public.lessons l on l.id = lv.lesson_id
    join public.modules m on m.id = l.module_id
    where l.course_id = v_course
      and lv.status = 'draft'
      and m.title in (${titleList})
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
where c.code = 'PHY 101' and lv.status = 'published' and m.title in (${titleList})
order by m.position, l.position;
`,
  "Publish drafts",
);

if (failed.length) {
  console.log(`\nPartial OK — published ${okJobs.length}/${jobs.length}; failed jobs: ${failed.map(([id]) => id).join(", ")}`);
  process.exit(0);
}

console.log("\nOK — PHY 101 Chapters 1–4 ingested and published.");
