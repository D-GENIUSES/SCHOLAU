import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSupabase, allowRequestWrite } from "@/lib/supabase/request";
import { putCourseMaterial } from "@/lib/r2-storage";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };
const reply = (message: string, status: number) => NextResponse.json({ message }, { status, headers });

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  if (!allowRequestWrite(request)) return reply("Request origin is not allowed.", 403);
  try {
    const client = await getRequestSupabase(request);
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return reply("Sign in to upload materials.", 401);

    const form = await request.formData();
    const offeringId = String(form.get("offeringId") ?? "");
    const topicMode = String(form.get("topicMode") ?? "new_module");
    const moduleTitle = String(form.get("moduleTitle") ?? "");
    const modulePositionRaw = form.get("modulePosition");
    const modulePosition = modulePositionRaw ? Number(modulePositionRaw) : null;
    const forceReprocess = form.get("forceReprocess") === "true";
    const file = form.get("file");
    if (!offeringId || !(file instanceof File)) return reply("Choose a course offering and a file.", 400);
    if (file.size > MAX_BYTES) return reply("File is too large (max 50 MB).", 413);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = EXT_MIME[ext];
    if (!mime) return reply("Unsupported file type.", 400);

    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const objectKey = `course-materials/${sha256}.${ext}`;

    await putCourseMaterial(objectKey, bytes, sha256, mime);

    const battleMix = {
      standard: Number(form.get("battleStandard") ?? 0.3),
      worked_solution: Number(form.get("battleWorked") ?? 0.3),
      fill_in_gap: Number(form.get("battleGap") ?? 0.4),
    };

    const { data, error } = await client.rpc("create_material_ingestion_job_v1", {
      p_offering_id: offeringId,
      p_sha256: sha256,
      p_filename: file.name,
      p_object_key: objectKey,
      p_bytes: bytes.length,
      p_mime_type: mime,
      p_topic_mode: topicMode,
      p_module_title: moduleTitle,
      p_module_position: modulePosition,
      p_confirmed_outline: null,
      p_battle_mix: battleMix,
      p_force_reprocess: forceReprocess,
      p_request_key: randomUUID(),
    });
    if (error) return reply("Could not queue ingestion.", 422);
    const workerSecret = process.env.INGESTION_WORKER_SECRET;
    if (workerSecret && !(data as { duplicate_file?: boolean }).duplicate_file) {
      const workerUrl = new URL("/api/material-ingestion/worker", request.url);
      void fetch(workerUrl, { method: "POST", headers: { "x-ingestion-worker-secret": workerSecret } }).catch(() => undefined);
    }
    return NextResponse.json(data, { headers });
  } catch (e) {
    if (e instanceof Error && e.message === "R2_NOT_CONFIGURED") return reply("Storage is not configured.", 503);
    if (e instanceof Error && (e.message === "R2_SIZE_MISMATCH" || e.message === "R2_HASH_MISMATCH")) {
      return reply("Uploaded file failed storage verification.", 503);
    }
    return reply("Upload failed.", 503);
  }
}

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) return reply("Missing job id.", 400);
  try {
    const client = await getRequestSupabase(request);
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return reply("Sign in to continue.", 401);
    const { data, error } = await client.rpc("get_material_ingestion_job_v1", { p_job_id: jobId });
    if (error) return reply("Job not found.", 404);
    return NextResponse.json(data, { headers });
  } catch {
    return reply("Could not load job.", 503);
  }
}
