/**
 * End-to-end without browser: R2 + SQL job + worker.
 * Run from repo root: node --env-file=apps/web/.env.local apps/web/scripts/run-local-ingestion-e2e.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const workerSecret = process.env.INGESTION_WORKER_SECRET;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const content = `Entrepreneurship is the process of identifying opportunities and organizing resources to create value.
Innovation distinguishes entrepreneurs from small business owners who only replicate existing models.
Students should explain opportunity recognition in their own words and apply it to a Nigerian example.`;
const bytes = Buffer.from(content, "utf8");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const objectKey = `course-materials/${sha256}.txt`;
const filename = "local-e2e-entrepreneurship.txt";
const jobId = randomUUID();

function putR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) throw new Error("R2_NOT_CONFIGURED");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: bytes,
      ContentType: "text/plain",
      Metadata: { sha256 },
    }),
  );
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
console.log("1) R2 upload…");
await putR2();

const { data: offering } = await admin.from("course_offerings").select("id, course_id").eq("status", "published").limit(1).single();
const { data: adminRow } = await admin.from("user_roles").select("user_id").eq("role", "admin").limit(1).single();
if (!offering?.id || !adminRow?.user_id) throw new Error("Need published offering + admin user");

console.log("2) Queue job (SQL)…");
const sql = `
insert into private.course_materials (course_id, sha256, object_key, filename, bytes, published)
values ('${offering.course_id}', '${sha256}', '${objectKey}', '${filename}', ${bytes.length}, false)
on conflict (course_id, sha256) do update set object_key = excluded.object_key, filename = excluded.filename, bytes = excluded.bytes, updated_at = now();
insert into private.material_ingestion_jobs (
  id, offering_id, course_id, uploaded_by, sha256, filename, object_key, bytes, mime_type,
  topic_mode, module_title, module_position, status, force_reprocess
) values (
  '${jobId}', '${offering.id}', '${offering.course_id}', '${adminRow.user_id}', '${sha256}', '${filename}', '${objectKey}',
  ${bytes.length}, 'text/plain', 'new_module', 'Local E2E — Entrepreneurship basics', 98, 'pending', true
);`;
const sqlFile = join(tmpdir(), `scholau-ingestion-${jobId}.sql`);
writeFileSync(sqlFile, sql.trim());
try {
  execSync(`npx supabase db query --linked -f "${sqlFile}"`, { cwd: root, stdio: "inherit" });
} finally {
  unlinkSync(sqlFile);
}

console.log("3) Worker…");
const res = await fetch(`${site}/api/material-ingestion/worker`, {
  method: "POST",
  headers: { "x-ingestion-worker-secret": workerSecret ?? "" },
});
const raw = await res.text();
let body;
try {
  body = JSON.parse(raw);
} catch {
  console.error("   Worker returned non-JSON (is dev server running on", site, "?):", raw.slice(0, 120));
  process.exit(1);
}
console.log("   ", res.status, body);

if (body.results?.[0]?.ok) {
  console.log("\nOK — drafts at http://localhost:3000/admin/review");
} else {
  console.log("\nCheck job:", jobId);
}
