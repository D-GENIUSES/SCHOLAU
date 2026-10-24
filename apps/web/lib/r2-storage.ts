import "server-only";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

export async function putCourseMaterial(objectKey: string, bytes: Buffer, sha256: string, contentType: string) {
  const { client, bucket } = getR2Storage();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: bytes,
    ContentType: contentType,
    CacheControl: "private, max-age=31536000, immutable",
    Metadata: { sha256 },
  }));
  await verifyCourseMaterialObject(objectKey, bytes.length, sha256);
}

export async function verifyCourseMaterialObject(objectKey: string, bytes: number, sha256: string) {
  const { client, bucket } = getR2Storage();
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
  if (head.ContentLength !== bytes) throw new Error("R2_SIZE_MISMATCH");
  if (head.Metadata?.sha256 !== sha256) throw new Error("R2_HASH_MISMATCH");
}

export async function getCourseMaterialBytes(objectKey: string): Promise<Buffer> {
  const { client, bucket } = getR2Storage();
  const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
  const chunks: Uint8Array[] = [];
  const body = out.Body;
  if (!body || typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] !== "function") {
    throw new Error("R2_OBJECT_EMPTY");
  }
  for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function putLessonAsset(path: string, bytes: Buffer) {
  const { client, bucket } = getR2Storage();
  await client.send(new PutObjectCommand({
    Bucket: bucket, Key: `lesson-assets/${path}`, Body: bytes,
    ContentType: "image/webp", CacheControl: "private, max-age=3600",
    IfNoneMatch: "*",
  }));
}
