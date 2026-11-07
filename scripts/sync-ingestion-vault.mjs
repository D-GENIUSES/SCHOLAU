/**
 * Sync INGESTION_WORKER_SECRET into Supabase Vault (ingestion_worker_secret).
 * Requires: supabase CLI linked project, INGESTION_WORKER_SECRET in env.
 * Usage from repo root: node --env-file=apps/web/.env.local scripts/sync-ingestion-vault.mjs
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const secret = process.env.INGESTION_WORKER_SECRET?.trim();
if (!secret || secret.length < 16) {
  console.error("Set INGESTION_WORKER_SECRET (same as Vercel Production).");
  process.exit(1);
}

const escaped = secret.replace(/'/g, "''");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = `
do $$
begin
  delete from vault.secrets where name = 'ingestion_worker_secret';
exception when others then null;
end $$;
select vault.create_secret(
  '${escaped}',
  'ingestion_worker_secret',
  'Matches Vercel INGESTION_WORKER_SECRET for material ingestion worker'
);
`;

try {
  execSync(`supabase db query --linked`, {
    input: sql,
    cwd: root,
    stdio: ["pipe", "inherit", "inherit"],
    encoding: "utf8",
  });
  console.log("OK: ingestion_worker_secret stored in Supabase Vault.");
} catch {
  console.error("FAIL: run from repo root with linked Supabase project.");
  process.exit(1);
}
