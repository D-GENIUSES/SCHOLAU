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
  const offeringId = request.nextUrl.searchParams.get("offeringId") ?? "";
  const material = request.nextUrl.searchParams.get("material");
  if (!UUID_PATTERN.test(offeringId) || (material !== null && !/^[a-f0-9]{64}$/.test(material))) return reply("Choose a valid course and material.", 400);
  try {
    const client = await getRequestSupabase(request);
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return reply("Sign in to view course materials.", 401);
    if (material === null) {
      const { data, error } = await client.rpc("get_course_materials_v1", { p_offering_id: offeringId });
      if (error) return reply("Course materials could not be loaded. Check your enrollment or try again.", 403);
      return NextResponse.json({ items: data.items }, { headers });
    }
    const { data, error } = await client.rpc("get_course_material_access_v1", { p_offering_id: offeringId, p_sha256: material });
    if (error || !data?.object_key) return reply("This material is not available for your account.", 403);
    const { client: storage, bucket } = getR2Storage();
    const filename = String(data.filename).replace(/[\r\n]/g, "");
    const signedUrl = await getSignedUrl(storage, new GetObjectCommand({
      Bucket: bucket, Key: data.object_key,
      ResponseContentDisposition: `attachment; filename="course-material"; filename*=UTF-8''${encodeURIComponent(filename).replace(/'/g, "%27")}`,
      ResponseCacheControl: "private, no-store",
    }), { expiresIn: 300 });
    return new NextResponse(null, { status: 303, headers: { ...headers, Location: signedUrl } });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_BEARER_TOKEN") return reply("Sign in to continue.", 401);
    return reply("Course material access is temporarily unavailable.", 503);
  }
}
