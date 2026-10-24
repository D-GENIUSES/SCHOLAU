import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSupabase, allowRequestWrite } from "@/lib/supabase/request";
import { getR2Storage } from "@/lib/r2-storage";
import { readPhotoBody } from "@/lib/profile-photo-server";
import { courseMaterialSyncRequestSchema } from "@/lib/course-material-schema";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };
const reply = (message: string, status: number) => NextResponse.json({ message }, { status, headers });

export async function POST(request: NextRequest) {
  if (!allowRequestWrite(request)) return reply("Request origin is not allowed.", 403);
  try {
    const client = await getRequestSupabase(request);
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return reply("Sign in as an administrator.", 401);
    const body = courseMaterialSyncRequestSchema.safeParse(JSON.parse((await readPhotoBody(request, 4 * 1024 * 1024)).toString("utf8")));
    if (!body.success) return reply("Upload a valid course synchronization bundle (up to 4 MB).", 400);
    const { bundle, dryRun, publish } = body.data;
    // This RPC enforces administrator authorization before any storage lookups.
    const validation = await client.rpc("admin_sync_course_materials_v1", { p_bundle: bundle, p_dry_run: true, p_publish: publish });
    if (validation.error) return reply("Administrator access and a valid course bundle are required.", 403);
    if (validation.data.valid !== true) return NextResponse.json(validation.data, { status: 422, headers });
    const { client: storage, bucket } = getR2Storage();
    // Small bounded batches prevent large bundles from opening hundreds of requests.
    for (let offset = 0; offset < bundle.materials.length; offset += 4) {
      await Promise.all(bundle.materials.slice(offset, offset + 4).map(async material => {
        const object = await storage.send(new HeadObjectCommand({ Bucket: bucket, Key: material.object_key }));
        if (object.ContentLength !== material.bytes || object.Metadata?.sha256 !== material.sha256) throw new Error("MATERIAL_INTEGRITY_MISMATCH");
      }));
    }
    if (dryRun) return NextResponse.json({ ...validation.data, storageVerified: true }, { headers });
    const result = await client.rpc("admin_sync_course_materials_v1", { p_bundle: bundle, p_dry_run: false, p_publish: publish });
    if (result.error) return reply("The course could not be synchronized. No partial changes were saved for this course.", 422);
    return NextResponse.json({ ...result.data, storageVerified: true }, { headers });
  } catch (error) {
    if (error instanceof SyntaxError) return reply("The bundle must contain valid JSON.", 400);
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") return reply("Upload one course bundle up to 4 MB.", 413);
    if (error instanceof Error && error.message === "INVALID_BEARER_TOKEN") return reply("Sign in to continue.", 401);
    return reply("Source verification failed. Check that the files exist in R2 with the expected size and SHA-256 metadata.", 503);
  }
}
