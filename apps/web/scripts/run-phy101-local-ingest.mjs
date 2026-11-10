/**
 * Local PHY 101 ingest (uses fixed @scholau/core normalize; does not need prod worker deploy).
 * node --env-file=apps/web/.env.local --import tsx apps/web/scripts/run-phy101-local-ingest.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import {
  contentFingerprint,
  estimateMinutes,
  generateConceptFromSource,
  stableLogicalKey,
} from "@scholau/core/ingestion";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const courseCode = "PHY 101";
const moduleTitlePrefix = "Physics — Chapters 1–4";

const only = new Set(
  (process.env.PHY101_ONLY ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

const allFiles = [
  { path: join(root, "imports", "phy-101", "PHY101-CH-part1-p1-16.pdf"), moduleTitle: `${moduleTitlePrefix} (pages 1–16)`, position: 1, id: "1" },
  { path: join(root, "imports", "phy-101", "PHY101-CH-part2-p17-33.pdf"), moduleTitle: `${moduleTitlePrefix} (pages 17–33)`, position: 2, id: "2" },
  { path: join(root, "imports", "phy-101", "PHY101-CH-part3-p34-50.pdf"), moduleTitle: `${moduleTitlePrefix} (pages 34–50)`, position: 3, id: "3" },
  { path: join(root, "imports", "phy-101", "PHY101-CH-part4-p51-67.pdf"), moduleTitle: `${moduleTitlePrefix} (pages 51–67)`, position: 4, id: "4" },
];
const files = only.size ? allFiles.filter((f) => only.has(f.id)) : allFiles;

function sqlQuote(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function runSql(sql, label) {
  const sqlFile = join(tmpdir(), `scholau-phy101-local-${randomUUID()}.sql`);
  writeFileSync(sqlFile, sql.trim());
  try {
    console.log(label);
    execSync(`npx supabase db query --linked -f "${sqlFile}"`, { cwd: root, stdio: "inherit" });
  } finally {
    unlinkSync(sqlFile);
  }
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

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const { data: course } = await admin.from("courses").select("id, code, title").eq("code", courseCode).maybeSingle();
if (!course) throw new Error("PHY 101 course not found");
const { data: offering } = await admin
  .from("course_offerings")
  .select("id")
  .eq("course_id", course.id)
  .eq("status", "published")
  .order("id", { ascending: true })
  .limit(1)
  .maybeSingle();
if (!offering) throw new Error("No published PHY 101 offering");
const { data: adminRow } = await admin.from("user_roles").select("user_id").eq("role", "admin").limit(1).single();
if (!adminRow?.user_id) throw new Error("No admin user");

console.log(`Course: ${course.code} — ${course.title}`);
console.log(`Offering: ${offering.id}\n`);

const succeeded = [];
const failed = [];

for (const spec of files) {
  const { bytes, sha256, objectKey, filename } = await putPdf(spec.path);
  const jobId = randomUUID();
  const fingerprint = contentFingerprint(bytes.toString("utf8").slice(0, 5000));
  const sourceRef = `${filename} [source SHA-256 ${sha256}]`;

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
  ${bytes.length}, 'application/pdf', 'new_module', ${sqlQuote(spec.moduleTitle)}, ${spec.position}, 'processing', true
);
`,
    `Job ${jobId} for ${filename}`,
  );

  try {
    console.log(`Gemini extract ${filename}…`);
    let concept = null;
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        concept = await generateConceptFromSource({
          courseCode,
          sourceSha256: sha256,
          filename,
          mimeType: "application/pdf",
          moduleTitle: spec.moduleTitle,
          modulePosition: spec.position,
          lessonPosition: 1,
          battleMix: { standard: 0.3, worked_solution: 0.3, fill_in_gap: 0.4 },
          fileBytes: bytes,
        });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.log(`  attempt ${attempt} failed: ${err?.cause?.message ?? err.message}`);
      }
    }
    if (!concept) throw lastErr ?? new Error("generation failed");

    const logicalKey = stableLogicalKey(courseCode, sha256, spec.position, 100);
    const lesson = {
      course_code: courseCode,
      module_position: spec.position,
      module_title: spec.moduleTitle,
      lesson_position: 1,
      title: concept.title,
      objective: concept.objective ?? "Explain this concept in your own words and apply it to a new example.",
      estimated_minutes: estimateMinutes(concept.blocks.map((b) => ("text" in b ? b.text : "")).join(" ")),
      blocks: concept.blocks,
      flashcards: concept.flashcards ?? [],
      source_reference: sourceRef,
      logical_key: logicalKey,
    };
    const questions = [...concept.learning_questions, ...concept.battle_questions].map((q, i) => ({
      ...q,
      course_code: courseCode,
      source_reference: q.source_reference || sourceRef,
      logical_question_key: q.logical_question_key || `${logicalKey}-q${i + 1}`,
    }));

    const requestKey = randomUUID();
    const commit = await admin.rpc("service_ingestion_import_v1", {
      p_job_id: jobId,
      p_lessons: [lesson],
      p_questions: questions,
      p_request_key: requestKey,
    });
    if (commit.error) throw new Error(commit.error.message);

    await admin.rpc("service_record_ingestion_evidence_v1", {
      p_job_id: jobId,
      p_logical_key: logicalKey,
      p_fingerprint: fingerprint,
      p_source_reference: sourceRef,
      p_source_text: concept.blocks.map((b) => ("text" in b ? b.text : "")).join("\n").slice(0, 2000),
    });

    await admin.rpc("finish_material_ingestion_job_v1", {
      p_job_id: jobId,
      p_status: "succeeded",
      p_stats: { new_lessons: 1, new_questions: questions.length, fingerprint, local: true },
      p_error: null,
    });

    console.log(`  OK — ${concept.title} (${questions.length} questions)`);
    succeeded.push({ jobId, sha256, moduleTitle: lesson.module_title, title: concept.title });
  } catch (e) {
    const msg = e?.cause?.message ? `${e.message} :: ${e.cause.message}` : e.message;
    console.error(`  FAIL ${filename}:`, msg);
    await admin.rpc("finish_material_ingestion_job_v1", {
      p_job_id: jobId,
      p_status: "failed",
      p_stats: { local: true },
      p_error: String(msg).slice(0, 2000),
    });
    failed.push({ jobId, filename, error: msg });
  }
}

if (!succeeded.length) {
  console.error("All parts failed.");
  process.exit(1);
}

const titleList = succeeded.map((j) => sqlQuote(j.moduleTitle)).join(", ");
const shaList = succeeded.map((j) => sqlQuote(j.sha256)).join(", ");

console.log("\nPublishing drafts…");
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
  select id into v_course from public.courses where code = 'PHY 101';
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
    where l.course_id = v_course and lv.status = 'draft' and m.title in (${titleList})
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
    where q.course_id = v_course and qv.status = 'draft' and qv.created_at > now() - interval '6 hours'
    order by qv.created_at
  loop
    perform public.admin_publish_v1('question_version', v_id, gen_random_uuid());
    v_n := v_n + 1;
  end loop;
  raise notice 'Published % question drafts', v_n;
end
$body$;

select m.position, m.title as module_title, lv.title as lesson_title, lv.status
from public.lesson_versions lv
join public.lessons l on l.id = lv.lesson_id
join public.modules m on m.id = l.module_id
join public.courses c on c.id = l.course_id
where c.code = 'PHY 101' and lv.status = 'published' and m.title in (${titleList})
order by m.position, l.position;
`,
  "Publish",
);

console.log("\nSucceeded:", succeeded.map((s) => s.title).join(" | "));
if (failed.length) console.log("Failed:", failed.map((f) => f.filename).join(", "));
console.log(failed.length ? "\nPartial OK — PHY 101 local ingest finished." : "\nOK — PHY 101 Chapters 1–4 ingested and published.");
