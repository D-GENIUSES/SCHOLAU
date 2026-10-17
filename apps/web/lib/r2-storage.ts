import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Credentials stay in the Node server; never import this module from client code. */
export function getR2Storage() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) throw new Error("R2_NOT_CONFIGURED");
  if (!/^[a-f0-9]{32}$/.test(accountId)) throw new Error("INVALID_R2_ACCOUNT");
  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 3,
    }),
  };
}

export const ASSET_URL_SECONDS = 3600;

export async function signLessonAsset(path: string) {
  const { client, bucket } = getR2Storage();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: `lesson-assets/${path}` }), { expiresIn: ASSET_URL_SECONDS });
}

export async function putLessonAsset(path: string, bytes: Buffer) {
  const { client, bucket } = getR2Storage();
  await client.send(new PutObjectCommand({
    Bucket: bucket, Key: `lesson-assets/${path}`, Body: bytes,
    ContentType: "image/webp", CacheControl: "private, max-age=3600",
    IfNoneMatch: "*",
  }));
}
