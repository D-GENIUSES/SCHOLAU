import { NextRequest, NextResponse } from "next/server";
import { getRequestSupabase } from "@/lib/supabase/request";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };
  const path = request.nextUrl.searchParams.get("path");
  if (!path || !/^avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(path)) return new NextResponse(null, { status: 404, headers });
  try {
    const client = await getRequestSupabase(request);
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return new NextResponse(null, { status: 401, headers });
    const result = await client.rpc("get_profile_photo_v1", { p_path: path });
    if (result.error || !result.data?.image_base64) return new NextResponse(null, { status: 404, headers });
    return new NextResponse(new Uint8Array(Buffer.from(result.data.image_base64, "base64")), { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch (error) { return new NextResponse(null, { status: error instanceof Error && error.message === "INVALID_BEARER_TOKEN" ? 401 : 503, headers }); }
}
