import { NextRequest, NextResponse } from "next/server";
import { getRequestSupabase } from "@/lib/supabase/request";

export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };
const fail = (message: string, status: number) => NextResponse.json({ message }, { status, headers });

/** Student material uploads are no longer accepted. Existing submissions remain downloadable for review. */
export async function POST() {
  return fail("Only lecturers and administrators can upload course materials.", 403);
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
