import { NextRequest, NextResponse } from "next/server";
import { isApiError } from "@scholau/api";
import { createScholauApi } from "@scholau/api";
import { getRequestSupabase, allowRequestWrite } from "@/lib/supabase/request";
import { cropSchema, MAX_PHOTO_BYTES, normalizeProfilePhoto, PhotoInputError } from "@/lib/profile-photo-image";
import { getPhotoWriter, readPhotoBody } from "@/lib/profile-photo-server";

export const runtime = "nodejs";
const reply = (message: string, status: number) => NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });

async function change(request: NextRequest, remove: boolean) {
  if (!allowRequestWrite(request)) return reply("Request origin is not allowed.", 403);
  try {
    const client = await getRequestSupabase(request);
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return reply("Sign in to change your photo.", 401);
    const profile = await createScholauApi(client).getMyProfile();
    if (profile.id !== data.user.id) return reply("Account access required.", 403);
    const writer = getPhotoWriter();
    if (!writer) return reply("Photo uploads are not configured on this server yet.", 503);
    let expectedPath: string | null;
    let encoded: string | null = null;
    if (remove) {
      if (!request.headers.get("content-type")?.startsWith("application/json")) return reply("Invalid request.", 415);
      const body = JSON.parse((await readPhotoBody(request, 2048)).toString("utf8"));
      if (!body || typeof body !== "object" || Array.isArray(body)) return reply("Invalid request.", 400);
      if (body.expectedPath !== null && typeof body.expectedPath !== "string") return reply("Reload your profile before trying again.", 400);
      expectedPath = body.expectedPath;
    } else {
      const type = request.headers.get("content-type") ?? "";
      if (!type.startsWith("multipart/form-data;")) return reply("Upload a photo file.", 415);
      const bytes = await readPhotoBody(request, MAX_PHOTO_BYTES + 65536);
      const form = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": type } }).formData();
      const file = form.get("file");
      if (!(file instanceof File)) return reply("Choose a photo file.", 400);
      if (file.size > MAX_PHOTO_BYTES) return reply("Choose a photo up to 5 MB.", 413);
      const expected = form.get("expectedPath");
      if (typeof expected !== "string" || expected.length > 300) return reply("Reload your profile before trying again.", 400);
      expectedPath = expected || null;
      const cropValue = form.get("crop");
      const crop = cropSchema.safeParse(typeof cropValue === "string" ? JSON.parse(cropValue) : null);
      if (!crop.success) return reply("Adjust the crop and try again.", 400);
      encoded = (await normalizeProfilePhoto(Buffer.from(await file.arrayBuffer()), file.type, crop.data)).toString("base64");
    }
    const result = await writer.rpc("service_set_profile_photo_v1", { p_user_id: data.user.id, p_image_base64: encoded, p_expected_path: expectedPath });
    if (result.error) {
      if (result.error.message === "STALE_REVISION") return reply("Your photo changed on another device. Reload your profile before trying again.", 409);
      if (result.error.message === "FORBIDDEN") return reply("This account cannot change its photo.", 403);
      return reply("Your photo could not be saved. Please try again.", 503);
    }
    return NextResponse.json({ avatarPath: result.data.avatar_path }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_BEARER_TOKEN") return reply("Sign in to continue.", 401);
    if (error instanceof PhotoInputError) return reply(error.message, 400);
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") return reply("Choose a photo up to 5 MB.", 413);
    if (error instanceof SyntaxError) return reply("The request is invalid. Try selecting your photo again.", 400);
    if (isApiError(error, "FORBIDDEN") || isApiError(error, "UNAUTHENTICATED")) return reply("Your account cannot change its photo. Sign in again or contact support.", 403);
    return reply("Your photo could not be saved. Please try again.", 503);
  }
}
export async function POST(request: NextRequest) { return change(request, false); }
export async function DELETE(request: NextRequest) { return change(request, true); }
