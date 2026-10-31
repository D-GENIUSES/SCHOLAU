/**
 * Copy the BIO 1–7 PDF, upload it to R2, import lesson drafts, and publish them.
 * node --env-file=apps/web/.env.local scripts/import-bio101-lessons.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "apps/web/package.json"));
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const sourcePdf = String.raw`C:\Users\DELL\AppData\Local\Packages\5319275A.WhatsAppDesktop_cv1g1gvanyjgm\LocalState\sessions\3DE16AF2B7B041F59923671DBECF679C71D4531A\transfers\2026-44\BIO CH.1-7 .pdf`;
const localPdfDir = join(root, "imports", "bio-101", "source");
const localPdf = join(localPdfDir, "BIO-CH-1-7.pdf");
const lessonsPath = join(root, "supabase", "content", "bio-101-chapters-1-7-lessons-20261031.json");

function r2() {
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

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

mkdirSync(localPdfDir, { recursive: true });
if (!existsSync(sourcePdf)) throw new Error(`Missing PDF: ${sourcePdf}`);
copyFileSync(sourcePdf, localPdf);

const bytes = readFileSync(localPdf);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const objectKey = `course-materials/${sha256}.pdf`;
const { client, bucket } = r2();
await client.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: bytes,
    ContentType: "application/pdf",
    Metadata: { sha256 },
  }),
);
console.log(`R2 uploaded ${objectKey} (${bytes.length} bytes)`);

const lessons = JSON.parse(readFileSync(lessonsPath, "utf8"));
if (!Array.isArray(lessons) || lessons.length === 0) throw new Error("Lesson JSON is empty");
const jsonLiteral = JSON.stringify(lessons);
if (jsonLiteral.includes("$bio101$")) throw new Error("JSON contains the dollar-quote tag");

const requestKey = randomUUID();
const sql = `
do $body$
declare
  v_admin uuid;
  v_course uuid;
  v_import jsonb;
  v_item jsonb;
  v_id uuid;
begin
  select user_id into v_admin from public.user_roles where role = 'admin' order by user_id limit 1;
  if v_admin is null then raise exception 'No administrator account'; end if;
  select id into v_course from public.courses where code = 'BIO 101';
  if v_course is null then raise exception 'BIO 101 course not found'; end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);

  insert into private.course_materials (course_id, sha256, object_key, filename, bytes, published)
  values (v_course, ${sqlQuote(sha256)}, ${sqlQuote(objectKey)}, 'BIO CH.1-7.pdf', ${bytes.length}, true)
  on conflict (course_id, sha256) do update
    set object_key = excluded.object_key,
        filename = excluded.filename,
        bytes = excluded.bytes,
        published = true,
        updated_at = now();

  v_import := public.admin_import_lessons_v1($bio101$${jsonLiteral}$bio101$::jsonb, false, '${requestKey}'::uuid);
  if coalesce(v_import->>'valid','false') <> 'true' or coalesce(v_import->>'imported','false') <> 'true' then
    raise exception 'BIO 101 import failed: %', v_import;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(v_import->'created', '[]'::jsonb)) loop
    v_id := (v_item->>'lesson_version_id')::uuid;
    perform public.admin_publish_v1('lesson_version', v_id, gen_random_uuid());
  end loop;

  raise notice 'BIO 101 imported % lessons', jsonb_array_length(v_import->'created');
end
$body$;

select m.position as module_position, m.title as module_title, l.position as lesson_position,
       lv.title, lv.status, jsonb_array_length(lv.flashcards) as flashcards
from public.lesson_versions lv
join public.lessons l on l.id = lv.lesson_id
join public.modules m on m.id = l.module_id
join public.courses c on c.id = l.course_id
where c.code = 'BIO 101' and lv.status = 'published'
order by m.position, l.position;
`;

const sqlFile = join(tmpdir(), `scholau-bio101-${requestKey}.sql`);
writeFileSync(sqlFile, sql, "utf8");
try {
  execSync(`npx supabase db query --linked -f "${sqlFile}"`, { cwd: root, stdio: "inherit" });
} finally {
  unlinkSync(sqlFile);
}
console.log("BIO 101 lesson import finished.");
