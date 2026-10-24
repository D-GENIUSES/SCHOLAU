import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processIngestionJob } from "@/lib/ingestion/process-job";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-ingestion-worker-secret");
  if (!secret || secret !== process.env.INGESTION_WORKER_SECRET) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403, headers });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ message: "Server misconfigured" }, { status: 503, headers });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: claim, error: claimError } = await admin.rpc("claim_material_ingestion_jobs_v1", { p_limit: 1 });
  if (claimError) return NextResponse.json({ message: claimError.message }, { status: 500, headers });
  const jobs = (claim?.jobs ?? []) as Record<string, unknown>[];
  if (jobs.length === 0) return NextResponse.json({ processed: 0 }, { headers });

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const raw of jobs) {
    const job = raw as Parameters<typeof processIngestionJob>[1];
    try {
      await processIngestionJob(admin, job);
      results.push({ id: job.id, ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      await admin.rpc("finish_material_ingestion_job_v1", {
        p_job_id: job.id,
        p_status: "failed",
        p_stats: {},
        p_error: message,
      });
      results.push({ id: job.id, ok: false, error: message });
    }
  }
  return NextResponse.json({ processed: results.length, results }, { headers });
}
