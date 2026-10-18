import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getRequestSupabase, allowRequestWrite } from "@/lib/supabase/request";
import { readPhotoBody } from "@/lib/profile-photo-server";
import { UUID_PATTERN, validLessonAssetPath } from "@/lib/lesson-asset-path";
import { ASSET_URL_SECONDS, putLessonAsset, signLessonAsset } from "@/lib/r2-storage";

export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };
const reply = (message: string, status: number) => NextResponse.json({ message }, { status, headers });

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!validLessonAssetPath(path)) return reply("Invalid image path.", 400);
  try {
    const client = await getRequestSupabase(request);
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return reply("Sign in to view this image.", 401);
    const allowed = await client.rpc("can_read_lesson_asset_v1", { p_path: path });
    if (allowed.error) return reply("Image access is temporarily unavailable.", 503);
    if (allowed.data !== true) return reply("You cannot view this image.", 403);
    let signedUrl: string;
    const provider = process.env.LESSON_ASSET_STORAGE ?? "supabase";
    if (provider === "r2") signedUrl = await signLessonAsset(path);
    else if (provider === "supabase") {
      const result = await client.storage.from("lesson-assets").createSignedUrl(path, ASSET_URL_SECONDS);
      if (result.error || !result.data?.signedUrl) return reply("Image unavailable.", 404);
      signedUrl = result.data.signedUrl;
    } else return reply("Image storage is not configured.", 503);
    return NextResponse.json({ signedUrl, expiresIn: ASSET_URL_SECONDS }, { headers });
  } catch (error) { if (error instanceof Error && error.message === "INVALID_BEARER_TOKEN") return reply("Sign in to continue.", 401); return reply("Image access is temporarily unavailable.", 503); }
}

/** Admin uploads are proxied to enforce the size limit and decode images before storing them. */
export async function POST(request: NextRequest) {
  if (!allowRequestWrite(request)) return reply("Request origin is not allowed.", 403);
  const lessonId = request.nextUrl.searchParams.get("lessonId") ?? "";
  if (!UUID_PATTERN.test(lessonId)) return reply("Choose a valid lesson.", 400);
  try {
    const client = await getRequestSupabase(request);
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return reply("Sign in to upload an image.", 401);
    const permission = await client.rpc("lesson_asset_upload_course_v1", { p_lesson_id: lessonId });
    if (permission.error) return reply("Upload access is temporarily unavailable.", 503);
    if (typeof permission.data !== "string" || !UUID_PATTERN.test(permission.data)) return reply("Administrator access to this lesson is required.", 403);
    if (process.env.LESSON_ASSET_STORAGE !== "r2") return reply("Image uploads are not enabled.", 503);
    const type = request.headers.get("content-type") ?? "";
    if (!type.startsWith("multipart/form-data;")) return reply("Upload an image file.", 415);
    const bytes = await readPhotoBody(request, MAX_BYTES + 65536);
    const form = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": type } }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return reply("Choose an image file.", 400);
    if (file.size > MAX_BYTES) return reply("Choose an image up to 5 MB.", 413);
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) return reply("Choose a PNG, JPEG, WebP or GIF image.", 415);
    let image: Buffer;
    try {
      const decoder = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 32_000_000 });
      const metadata = await decoder.metadata();
      if (!["png", "jpeg", "webp", "gif"].includes(metadata.format ?? "")) return reply("Unsupported image format.", 415);
      image = await decoder.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
    } catch { return reply("This image could not be read.", 415); }
    if (image.length > MAX_BYTES) return reply("The processed image is too large.", 413);
    const path = `${permission.data}/${lessonId}/${randomUUID()}.webp`;
    await putLessonAsset(path, image);
    return NextResponse.json({ path, contentType: "image/webp", bytes: image.length }, { status: 201, headers });
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") return reply("Choose an image up to 5 MB.", 413);
    if (error instanceof TypeError || error instanceof SyntaxError) return reply("Invalid upload request.", 400);
    return reply("The image could not be saved. Please try again.", 503);
  }
}
