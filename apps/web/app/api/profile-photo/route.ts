import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getRequestSupabase } from "@/lib/supabase/request";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };
  const path = request.nextUrl.searchParams.get("path");
  if (!path || !/^avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(path)) return new NextResponse(null, { status: 404, headers });
  const requestedSize = request.nextUrl.searchParams.get("size");
  const size = requestedSize === null ? null : Number(requestedSize);
  if (size !== null && ![64, 80, 112, 144, 192].includes(size)) return new NextResponse(null, { status: 400, headers });
  try {
    const client = await getRequestSupabase(request);
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return new NextResponse(null, { status: 401, headers });
    const result = await client.rpc(request.nextUrl.searchParams.get("scope") === "public" ? "get_public_profile_photo_v1" : "get_profile_photo_v1", { p_path: path });
    if (result.error || !result.data?.image_base64) return new NextResponse(null, { status: 404, headers });
    const original = Buffer.from(result.data.image_base64, "base64");
    const image = size === null ? original : await sharp(original)
      .resize(size, size, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 76, effort: 2 }).toBuffer();
    return new NextResponse(new Uint8Array(image), { headers: {
      ...headers,
      // Versioned paths change with each upload. Cache only in this signed-in
      // browser; never share responses between cookies, bearer tokens or a CDN.
      "Cache-Control": "private, max-age=300",
      "Vary": "Cookie, Authorization",
      "Content-Type": "image/webp",
    } });
  } catch (error) { return new NextResponse(null, { status: error instanceof Error && error.message === "INVALID_BEARER_TOKEN" ? 401 : 503, headers }); }
}
