import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_URL } from "@/lib/env";
import { getRequestSupabase, allowRequestWrite } from "@/lib/supabase/request";
import { readPhotoBody } from "@/lib/profile-photo-server";
import { putCourseMaterial } from "@/lib/r2-storage";
import { prepareStudentMaterialUpload, verifyStudentMaterialTicket, readStudentMaterialUpload, removeStudentMaterialUpload } from "@/lib/student-material-upload";

export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };
const fail = (message: string, status: number) => NextResponse.json({ message }, { status, headers });

/** Only small authorization/finalization messages pass through Vercel. File bytes go directly to private R2. */
export async function POST(request: NextRequest) {
  if (!allowRequestWrite(request)) return fail("Request origin is not allowed.", 403);
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) return fail("Use the secure upload form.", 415);
  try {
    const client = await getRequestSupabase(request);
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return fail("Sign in to suggest course materials.", 401);
    const body = await readPhotoBody(request, 16384);
    const input = JSON.parse(Buffer.from(body).toString()) as Record<string, unknown>;
    const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return fail("Material uploads are temporarily unavailable.", 503);
    const item = input.action === "complete" && typeof input.ticket === "string"
      ? verifyStudentMaterialTicket(input.ticket, auth.user.id, serviceKey) : null;
    const offeringId = item?.offeringId ?? request.nextUrl.searchParams.get("offeringId") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(offeringId)) return fail("Choose a valid enrolled course.", 400);
    const access = await client.rpc("can_submit_student_material_v1", { p_offering_id: offeringId });
    if (access.error || access.data?.allowed !== true) return fail("You must be enrolled in this course.", 403);
    if (input.action === "prepare") {
      if (typeof input.filename !== "string" || typeof input.bytes !== "number") return fail("Select a supported file up to 50 MB.", 400);
      const upload = await prepareStudentMaterialUpload(auth.user.id, offeringId, input.filename, input.bytes, serviceKey);
      return NextResponse.json(upload, { headers });
    }
    if (!item) return fail("Start a new upload.", 400);
    const notes = typeof input.notes === "string" ? input.notes : "";
    if (notes.length > 500) return fail("Notes must be 500 characters or fewer.", 400);
    try {
      // Hash the actual private object, never a browser-supplied hash or storage key.
      const data = await readStudentMaterialUpload(item);
      await putCourseMaterial(data.objectKey, data.bytes, data.sha256, item.mimeType);
      const writer = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const receipt = await writer.rpc("register_student_material_upload_v1", {
        p_student_id: auth.user.id, p_offering_id: offeringId, p_sha256: data.sha256,
        p_object_key: data.objectKey, p_mime_type: item.mimeType, p_bytes: data.bytes.length,
      });
      if (receipt.error) return fail("The uploaded material could not be registered. Please try again.", 503);
      const submitted = await client.rpc("submit_student_material_v1", {
        p_offering_id: offeringId, p_filename: item.filename, p_sha256: data.sha256,
        p_object_key: data.objectKey, p_mime_type: item.mimeType, p_bytes: data.bytes.length, p_notes: notes,
      });
      if (submitted.error) return fail("The material could not be submitted for approval. Check your pending submissions.", 422);
      return NextResponse.json({ id: submitted.data.id, status: submitted.data.status }, { status: 201, headers });
    } finally {
      await removeStudentMaterialUpload(item.key).catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof Error && ["INVALID_UPLOAD", "INVALID_UPLOAD_TICKET", "UPLOAD_SIZE_MISMATCH"].includes(error.message)) return fail("Upload is invalid or expired. Select a supported file up to 50 MB and try again.", 400);
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") return fail("Upload request is too large.", 413);
    if (error instanceof SyntaxError) return fail("Invalid upload request.", 400);
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
