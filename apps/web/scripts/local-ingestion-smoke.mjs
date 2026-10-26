/**
 * Local smoke test (no browser): Gemini key, Supabase RPCs, ingestion worker.
 * Run from apps/web: node --env-file=.env.local scripts/local-ingestion-smoke.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const workerSecret = process.env.INGESTION_WORKER_SECRET;
const geminiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log("OK:", msg);
}

async function testGemini() {
  if (!geminiKey) {
    fail("GEMINI_API_KEY not set — source extraction will fail without importing drafts.");
    return;
  }
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const r = await ai.models.generateContent({ model, contents: "Reply exactly: GEMINI_OK" });
  const text = (r.text ?? "").trim();
  if (!text.includes("GEMINI_OK") && !text.includes("OK")) {
    fail(`Gemini returned unexpected text: ${text.slice(0, 80)}`);
    return;
  }
  ok(`Gemini (${model}) responded.`);
}

async function testSupabaseRpcs() {
  if (!url || !serviceKey) {
    fail("Supabase URL or service role key missing.");
    return;
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error: claimErr } = await admin.rpc("claim_material_ingestion_jobs_v1", { p_limit: 0 });
  if (claimErr) {
    fail(`claim_material_ingestion_jobs_v1 — apply migrations? ${claimErr.message}`);
    return;
  }
  ok("Ingestion RPCs present (claim_material_ingestion_jobs_v1).");
  const { data: offerings, error: offErr } = await admin
    .from("course_offerings")
    .select("id, course:courses(code, title)")
    .eq("status", "published")
    .limit(3);
  if (offErr) fail(`Could not list offerings: ${offErr.message}`);
  else if (!offerings?.length) fail("No published offerings — create one before upload test.");
  else ok(`Published offerings available (${offerings.length}). Example id: ${offerings[0].id}`);
}

async function testWorker() {
  if (!workerSecret) {
    fail("INGESTION_WORKER_SECRET not set — uploads will queue until worker is called manually.");
    return;
  }
  const res = await fetch(`${site}/api/material-ingestion/worker`, {
    method: "POST",
    headers: { "x-ingestion-worker-secret": workerSecret },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    fail(`Worker HTTP ${res.status}: ${body.message ?? JSON.stringify(body)}`);
    return;
  }
  ok(`Worker reachable (processed=${body.processed ?? 0}).`);
}

console.log("ScholAu material ingestion — local smoke test\n");
await testGemini();
await testSupabaseRpcs();
await testWorker();
console.log("\nBrowser E2E: sign in as lecturer/admin → http://localhost:3000/lecturer/materials → upload PDF/txt → watch job status → /admin/review (drafts).");
if (process.exitCode) process.exit(process.exitCode);
