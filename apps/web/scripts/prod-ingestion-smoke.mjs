/**
 * Production smoke: Gemini + Supabase RPCs + scholau.com worker.
 * Usage: INGESTION_WORKER_SECRET=... node --env-file=.env.local scripts/prod-ingestion-smoke.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const workerSecret = process.env.INGESTION_WORKER_SECRET;
const geminiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
const origin = process.env.PROD_SITE_URL ?? "https://scholau.com";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}
function ok(msg) {
  console.log("OK:", msg);
}

async function testGemini() {
  if (!geminiKey) return fail("GEMINI_API_KEY missing");
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const r = await ai.models.generateContent({ model, contents: "Reply: OK" });
  if (!(r.text ?? "").trim()) return fail("Gemini empty response");
  ok(`Gemini (${model})`);
}

async function testDb() {
  if (!url || !serviceKey) return fail("Supabase env missing");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await admin.rpc("claim_material_ingestion_jobs_v1", { p_limit: 0 });
  if (error) return fail(`claim RPC: ${error.message}`);
  ok("Ingestion RPCs on hosted Supabase");
}

async function testWorker() {
  if (!workerSecret) return fail("INGESTION_WORKER_SECRET missing (must match Vercel + Vault)");
  const res = await fetch(`${origin}/api/material-ingestion/worker`, {
    method: "POST",
    headers: { "x-ingestion-worker-secret": workerSecret },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return fail(`${origin} worker HTTP ${res.status}: ${body.message ?? JSON.stringify(body)}`);
  ok(`${origin} worker (processed=${body.processed ?? 0})`);
}

console.log(`ScholAu production ingestion smoke → ${origin}\n`);
await testGemini();
await testDb();
await testWorker();
if (process.exitCode) process.exit(process.exitCode);
