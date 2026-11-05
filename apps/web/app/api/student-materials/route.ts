import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSupabase, allowRequestWrite } from "@/lib/supabase/request";
import { readPhotoBody } from "@/lib/profile-photo-server";
import { putCourseMaterial } from "@/lib/r2-storage";

export const runtime = "nodejs";
// Keep multipart uploads below Vercel's 4.5 MB request-body limit.
const MAX_BYTES = 4 * 1024 * 1024;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };
const fail = (message: string, status: number) => NextResponse.json({ message }, { status, headers });
const allowedMime: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Student suggestions are stored privately. No AI work occurs until a reviewer approves. */
export async function POST(request: NextRequest) {
  if (!allowRequestWrite(request)) return fail("Request origin is not allowed.", 403);
  if (!(request.headers.get("content-type") ?? "").startsWith("multipart/form-data;")) {
    return fail("Upload a supported course material file.", 415);
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BYTES + 65536) return fail("The maximum file size is 4 MB.", 413);
  try {
    const client = await getRequestSupabase(request);
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return fail("Sign in to suggest course materials.", 401);
    // Authorization is checked before accepting an expensive multipart body or writing to storage.
    const url = new URL(request.url);
    const offeringId = url.searchParams.get("offeringId") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(offeringId)) return fail("Choose a valid enrolled course.", 400);
    const access = await client.rpc("can_submit_student_material_v1", { p_offering_id: offeringId });
    if (access.error || access.data?.allowed !== true) return fail("You must be enrolled in this course.", 403);

    const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return fail("Material uploads are temporarily unavailable.", 503);
    const writer = createClient(SUPABASE_URL, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const contentType = request.headers.get("content-type") ?? "";
    const bytes = await readPhotoBody(request, MAX_BYTES + 65536);
    const form = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": contentType } }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1) return fail("Select a file.", 400);
    if (file.size > MAX_BYTES || file.name.length > 240) return fail("File must be 4 MB or smaller with a short name.", 413);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = allowedMime[ext];
    if (!mime) return fail("Unsupported format. Use PDF, Word, PowerPoint, text or an image.", 415);
    const notes = String(form.get("notes") ?? "");
    if (notes.length > 500) return fail("Notes must be 500 characters or fewer.", 400);

    const data = Buffer.from(await file.arrayBuffer());
    const sha = createHash("sha256").update(data).digest("hex");
    const objectKey = "course-materials/" + sha + "." + ext;
    await putCourseMaterial(objectKey, data, sha, mime);
    const receipt = await writer.rpc("register_student_material_upload_v1", {
      p_student_id: auth.user.id, p_offering_id: offeringId, p_sha256: sha,
      p_object_key: objectKey, p_mime_type: mime, p_bytes: data.length,
    });
    if (receipt.error) return fail("The uploaded material could not be registered. Please try again.", 503);
    const submitted = await client.rpc("submit_student_material_v1", {
      p_offering_id: offeringId, p_filename: file.name, p_sha256: sha,
      p_object_key: objectKey, p_mime_type: mime, p_bytes: data.length, p_notes: notes,
    });
    if (submitted.error) return fail("The material could not be submitted for approval. Check your pending submissions.", 422);
    return NextResponse.json({ id: submitted.data.id, status: submitted.data.status }, { status: 201, headers });
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") return fail("File is too large.", 413);
    if (error instanceof Error && error.message === "INVALID_BEARER_TOKEN") return fail("Sign in again.", 401);
    return fail("Material upload failed. Please try again.", 503);
  }
}
/** Private source retrieval for enrolled submitters and authorized reviewers only. */
export async function GET(request: NextRequest) {
  const submissionId = request.nextUrl.searchParams.get("submissionId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) return fail("Choose a valid submission.", 400);
  try {
    const client = await getRequestSupabase(request);
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return fail("Sign in to view this source.", 401);
    const { data, error } = await client.rpc("get_student_material_source_v1", { p_submission_id: submissionId });
    if (error || !data?.object_key) return fail("This submission is unavailable for your account.", 403);
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const { getR2Storage } = await import("@/lib/r2-storage");
    const { client: storage, bucket } = getR2Storage();
    const filename = String(data.filename ?? "course-material").replace(/[\r\n]/g, "");
    const url = await getSignedUrl(storage, new GetObjectCommand({
      Bucket: bucket,
      Key: data.object_key,
      ResponseContentDisposition: "attachment; filename=\"source\"; filename*=UTF-8''" + encodeURIComponent(filename).replace(/'/g, "%27"),
      ResponseCacheControl: "private, no-store",
    }), { expiresIn: 300 });
    return new NextResponse(null, { status: 303, headers: { ...headers, Location: url } });
  } catch {
    return fail("The source is temporarily unavailable.", 503);
  }
}
