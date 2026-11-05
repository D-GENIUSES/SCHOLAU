import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Storage } from "@/lib/r2-storage";

export const MAX_STUDENT_MATERIAL_BYTES = 50 * 1024 * 1024;
const MIME: Record<string, string> = {
  pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", txt: "text/plain",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
};
type Ticket = { userId: string; offeringId: string; key: string; filename: string; bytes: number; mimeType: string; expires: number };
const signature = (payload: string, secret: string) => createHmac("sha256", secret).update("student-material-upload-v1:" + payload).digest();

export async function prepareStudentMaterialUpload(userId: string, offeringId: string, filename: string, bytes: number, secret: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_STUDENT_MATERIAL_BYTES
    || !filename.trim() || filename.length > 240 || !MIME[ext]) throw new Error("INVALID_UPLOAD");
  const item: Ticket = { userId, offeringId, filename, bytes, mimeType: MIME[ext],
    key: "student-material-uploads/" + userId + "/" + randomUUID() + "." + ext,
    expires: Date.now() + 10 * 60 * 1000 };
  const payload = Buffer.from(JSON.stringify(item)).toString("base64url");
  const ticket = payload + "." + signature(payload, secret).toString("base64url");
  // No placeholder body checksum: the browser sends the actual file bytes.
  const { client, bucket } = getR2Storage(true);
  const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
    Bucket: bucket, Key: item.key, ContentType: item.mimeType, ContentLength: item.bytes,
  }), { expiresIn: 600, signableHeaders: new Set(["content-type", "content-length"]) });
  return { uploadUrl, ticket, mimeType: item.mimeType };
}

export function verifyStudentMaterialTicket(token: string, userId: string, secret: string): Ticket {
  const [payload, signed, ...extra] = token.split(".");
  if (!payload || !signed || extra.length || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]{43}$/.test(signed)) throw new Error("INVALID_UPLOAD_TICKET");
  const actual = Buffer.from(signed, "base64url");
  const expected = signature(payload, secret);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("INVALID_UPLOAD_TICKET");
  const item = JSON.parse(Buffer.from(payload, "base64url").toString()) as Ticket;
  if (item.userId !== userId || item.expires < Date.now() || !Number.isSafeInteger(item.bytes)
    || item.bytes < 1 || item.bytes > MAX_STUDENT_MATERIAL_BYTES
    || !item.key.startsWith("student-material-uploads/" + userId + "/")) throw new Error("INVALID_UPLOAD_TICKET");
  return item;
}

export async function readStudentMaterialUpload(item: Ticket) {
  const { client, bucket } = getR2Storage();
  const stored = await client.send(new GetObjectCommand({ Bucket: bucket, Key: item.key }));
  if (stored.ContentLength !== item.bytes || stored.ContentType !== item.mimeType || !stored.Body) throw new Error("UPLOAD_SIZE_MISMATCH");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stored.Body as AsyncIterable<Uint8Array>) {
    total += chunk.length;
    if (total > item.bytes || total > MAX_STUDENT_MATERIAL_BYTES) throw new Error("UPLOAD_SIZE_MISMATCH");
    chunks.push(Buffer.from(chunk));
  }
  if (total !== item.bytes) throw new Error("UPLOAD_SIZE_MISMATCH");
  const bytes = Buffer.concat(chunks);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const ext = item.filename.split(".").pop()!.toLowerCase();
  return { bytes, sha256, objectKey: "course-materials/" + sha256 + "." + ext };
}

export async function removeStudentMaterialUpload(key: string) {
  const { client, bucket } = getR2Storage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
