// Run with: node --env-file=apps/web/.env.local apps/web/scripts/migrate-lesson-assets.mjs [--copy]
// Defaults to inventory only. Never deletes the source or overwrites a different destination.
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const env = process.env;
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!env.NEXT_PUBLIC_SUPABASE_URL || !serviceKey) throw new Error("Server Supabase credentials are required.");
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const source = supabase.storage.from("lesson-assets");
const objects = [];
async function list(prefix = "") {
  for (let offset = 0; ; offset += 1000) {
    const result = await source.list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (result.error) throw new Error("Source listing failed; no files were changed.");
    for (const entry of result.data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) objects.push(path);
      else await list(path);
    }
    if (result.data.length < 1000) break;
  }
}
const buckets = await supabase.storage.listBuckets();
if (buckets.error) throw new Error("Could not inventory source buckets.");
if (buckets.data.some(bucket => bucket.id === "lesson-assets")) await list();
console.log(JSON.stringify({ mode: process.argv.includes("--copy") ? "copy" : "inventory", sourceObjects: objects.length }));
if (!process.argv.includes("--copy")) process.exit(0);
if (![env.R2_ACCOUNT_ID, env.R2_BUCKET, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY].every(Boolean)) throw new Error("R2 server credentials are required.");
const client = new S3Client({ region: "auto", endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } });
let copied = 0, verifiedExisting = 0;
for (const path of objects) {
  const result = await source.download(path);
  if (result.error) throw new Error("Source download failed; originals remain intact.");
  const bytes = Buffer.from(await result.data.arrayBuffer());
  const Key = `lesson-assets/${path}`;
  let existing;
  try { existing = await client.send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key })); }
  catch (error) { if (error.$metadata?.httpStatusCode !== 404) throw new Error("Destination check failed."); }
  if (existing) {
    if (digest(await existing.Body.transformToByteArray()) !== digest(bytes)) throw new Error("Destination differs; refusing to overwrite it.");
    verifiedExisting++;
    continue;
  }
  await client.send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key, Body: bytes, ContentType: result.data.type || "application/octet-stream", CacheControl: "private, max-age=3600", Metadata: { sha256: digest(bytes) }, IfNoneMatch: "*" }));
  const check = await client.send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key }));
  if (digest(await check.Body.transformToByteArray()) !== digest(bytes)) throw new Error("Destination verification failed; keep the source provider enabled.");
  copied++;
}
console.log(JSON.stringify({ copied, verifiedExisting, sourceObjects: objects.length, originalsRetained: true }));
