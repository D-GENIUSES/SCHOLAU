/**
 * Upload philosophy PDFs for AUE-GST 201: R2 + ingestion jobs + production worker.
 * node --env-file=apps/web/.env.local apps/web/scripts/run-philosophy-ingestion-batch.mjs
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
const site = process.env.INGESTION_SITE_URL ?? "https://scholau.com";
const courseCode = "AUE-GST 201";

const files = [
  {
    path: String.raw`c:\Users\DELL\Downloads\philosophy ch 1-5. (1).pdf`,
    moduleTitle: "Philosophy — Chapters 1–5",
    position: 1,
  },
  {
    path: String.raw`c:\Users\DELL\Downloads\philosophy 6-10.pdf`,
    moduleTitle: "Philosophy — Chapters 6–10",
    position: 2,
  },
  {
    path: String.raw`c:\Users\DELL\Downloads\PHILOSPHY, LOGIC AND HUMAN EXISTENCE QUESTIONS.pdf`,
    moduleTitle: "Philosophy — Logic & existence (questions)",
    position: 3,
  },
];

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

const { data: course, error: courseErr } = await admin.from("courses").select("id, code, title").eq("code", courseCode).maybeSingle();
if (courseErr || !course) throw new Error(`Course ${courseCode} not found`);

const { data: offering, error: offErr } = await admin
  .from("course_offerings")
  .select("id")
  .eq("course_id", course.id)
  .eq("status", "published")
  .order("id", { ascending: true })
  .limit(1)
  .maybeSingle();
if (offErr || !offering) throw new Error(`No published offering for ${courseCode}`);

const { data: adminRow } = await admin.from("user_roles").select("user_id").eq("role", "admin").limit(1).single();
if (!adminRow?.user_id) throw new Error("No admin user");

console.log(`Course: ${course.code} — ${course.title}`);
console.log(`Offering: ${offering.id}`);
console.log(`Worker site: ${site}\n`);

const jobIds = [];
for (const spec of files) {
  console.log(`Uploading ${spec.path}…`);
  const { bytes, sha256, objectKey, filename } = await putPdf(spec.path);
  const jobId = randomUUID();
  jobIds.push(jobId);
  const sql = `
insert into private.course_materials (course_id, sha256, object_key, filename, bytes, published)
values ('${course.id}', '${sha256}', '${objectKey}', ${sqlQuote(filename)}, ${bytes.length}, false)
on conflict (course_id, sha256) do update set object_key = excluded.object_key, filename = excluded.filename, bytes = excluded.bytes, updated_at = now();
insert into private.material_ingestion_jobs (
  id, offering_id, course_id, uploaded_by, sha256, filename, object_key, bytes, mime_type,
  topic_mode, module_title, module_position, status, force_reprocess
) values (
  '${jobId}', '${offering.id}', '${course.id}', '${adminRow.user_id}', '${sha256}', ${sqlQuote(filename)}, '${objectKey}',
  ${bytes.length}, 'application/pdf', 'new_module', ${sqlQuote(spec.moduleTitle)}, ${spec.position}, 'pending', true
);`;
  const sqlFile = join(tmpdir(), `scholau-phil-${jobId}.sql`);
  writeFileSync(sqlFile, sql.trim());
  try {
    execSync(`npx supabase db query --linked -f "${sqlFile}"`, { cwd: root, stdio: "inherit" });
  } finally {
    unlinkSync(sqlFile);
  }
  console.log(`  Job ${jobId}\n`);
}

console.log("Running worker until queue drains…");
for (let pass = 0; pass < 6; pass++) {
  const res = await fetch(`${site}/api/material-ingestion/worker`, {
    method: "POST",
    headers: { "x-ingestion-worker-secret": workerSecret ?? "" },
  });
  const body = await res.json().catch(() => ({}));
  console.log(`  pass ${pass + 1}:`, res.status, body);
  if (body.processed === 0 && !body.results?.length) break;
}

console.log("\nJobs:", jobIds.join(", "));
console.log("Review drafts:", `${site}/admin/review`);

function sqlQuote(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}
