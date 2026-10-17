import sharp from "sharp";
import { z } from "zod";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_SIZE = 512;
export const cropSchema = z.object({ zoom: z.number().min(1).max(3), panX: z.number().min(-1).max(1), panY: z.number().min(-1).max(1) }).strict();
export type PhotoCrop = z.infer<typeof cropSchema>;
export class PhotoInputError extends Error {}

export async function normalizeProfilePhoto(input: Buffer, mime: string, crop: PhotoCrop): Promise<Buffer> {
  if (!input.length || input.length > MAX_PHOTO_BYTES) throw new PhotoInputError("Choose a photo up to 5 MB.");
  const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
  if (!formats[mime]) throw new PhotoInputError("Choose a JPG, PNG or WebP photo.");
  // Reject unsupported decoders before asking the image library to parse input.
  const jpeg = input.length >= 3 && input[0] === 255 && input[1] === 216 && input[2] === 255;
  const png = input.length >= 8 && input.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  const webp = input.length >= 12 && input.subarray(0, 4).toString() === "RIFF" && input.subarray(8, 12).toString() === "WEBP";
  if (!(mime === "image/jpeg" && jpeg || mime === "image/png" && png || mime === "image/webp" && webp)) throw new PhotoInputError("The file contents do not match a supported photo format.");
  if (png) {
    for (let offset = 8; offset + 12 <= input.length;) {
      const length = input.readUInt32BE(offset);
      if (input.subarray(offset + 4, offset + 8).toString() === "acTL") throw new PhotoInputError("Animated images are not supported. Choose a still photo.");
      if (length > input.length - offset - 12) break;
      offset += length + 12;
    }
  }
  const parsed = cropSchema.safeParse(crop);
  if (!parsed.success) throw new PhotoInputError("The crop is invalid. Adjust the photo and try again.");
  try {
    const options = { limitInputPixels: 40_000_000, failOn: "warning" as const };
    const meta = await sharp(input, options).metadata();
    if (meta.format !== formats[mime] || (meta.pages ?? 1) !== 1 || !meta.width || !meta.height) throw new PhotoInputError("Choose a single, valid JPG, PNG or WebP image. Animations are not supported.");
    const rotated = (meta.orientation ?? 1) >= 5;
    const width = rotated ? meta.height : meta.width;
    const height = rotated ? meta.width : meta.height;
    if (Math.min(width, height) < 96) throw new PhotoInputError("Choose a photo at least 96 pixels wide and tall.");
    const size = Math.max(1, Math.floor(Math.min(width, height) / crop.zoom));
    const left = Math.max(0, Math.min(width - size, Math.round((width - size) * (1 - crop.panX) / 2)));
    const top = Math.max(0, Math.min(height - size, Math.round((height - size) * (1 - crop.panY) / 2)));
    const pipeline = () => sharp(input, options).autoOrient().extract({ left, top, width: size, height: size }).resize(PHOTO_SIZE, PHOTO_SIZE).flatten({ background: "#ffffff" }).toColourspace("srgb");
    let output = await pipeline().webp({ quality: 82, effort: 4 }).toBuffer();
    if (output.length > 262144) output = await pipeline().webp({ quality: 60, effort: 4 }).toBuffer();
    if (output.length > 262144) throw new PhotoInputError("This photo could not be compressed. Choose another photo.");
    return output;
  } catch (error) {
    if (error instanceof PhotoInputError) throw error;
    throw new PhotoInputError("This image could not be read. Choose a valid image up to 5 MB and 40 megapixels.");
  }
}
