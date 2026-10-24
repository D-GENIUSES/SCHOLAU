import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSupabase } from "@/lib/supabase/request";
import { getR2Storage } from "@/lib/r2-storage";
import { UUID_PATTERN } from "@/lib/lesson-asset-path";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };
const reply = (message: string, status: number) => NextResponse.json({ message }, { status, headers });

export async function GET(request: NextRequest) {
  const courseId = request.nextUrl.searchParams.get("courseId") ?? "";
  const sha256 = request.nextUrl.searchParams.get("sha256") ?? "";
  if (!UUID_PATTERN.test(courseId) || !/^[a-f0-9]{64}$/.test(sha256)) return reply("Invalid course or material hash.", 400);
  try {
    const client = await getRequestSupabase(request);
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return reply("Sign in as an administrator.", 401);
    const { data: access, error: accessError } = await client.rpc("admin_user_creation_access_v1");
    if (accessError || access?.actor_id !== auth.user.id) return reply("Administrator access required.", 403);
    const { data: meta, error } = await client.rpc("admin_get_course_material_object_v1", {
      p_course_id: courseId,
      p_sha256: sha256,
    });
    if (error || !meta?.object_key) return reply("Source file not found for this course.", 404);
    const row = meta as { object_key: string; filename: string };
    const { client: storage, bucket } = getR2Storage();
    const filename = String(row.filename).replace(/[\r\n]/g, "");
    const signedUrl = await getSignedUrl(
      storage,
      new GetObjectCommand({
        Bucket: bucket,
        Key: row.object_key,
        ResponseContentDisposition: `attachment; filename="source"; filename*=UTF-8''${encodeURIComponent(filename).replace(/'/g, "%27")}`,
        ResponseCacheControl: "private, no-store",
      }),
      { expiresIn: 300 },
    );
    return new NextResponse(null, { status: 303, headers: { ...headers, Location: signedUrl } });
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_BEARER_TOKEN") return reply("Sign in to continue.", 401);
    if (e instanceof Error && e.message === "R2_NOT_CONFIGURED") return reply("Storage is not configured.", 503);
    return reply("Could not open source file.", 503);
  }
}
