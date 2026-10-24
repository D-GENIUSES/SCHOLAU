import { z } from "zod";

export const materialSchema = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  object_key: z.string().regex(/^course-materials\/[a-f0-9]{64}\.(pdf|docx|pptx|txt|jpg|jpeg|png|webp)$/),
  filename: z.string().min(1).max(240),
  bytes: z.number().int().positive().max(100_000_000),
}).refine(value => value.object_key.split("/")[1]?.split(".")[0] === value.sha256, "Object key must match the source hash.");

export const courseMaterialBundleSchema = z.object({
  course_code: z.string().min(1).max(80),
  materials: z.array(materialSchema).min(1).max(100),
  lessons: z.array(z.record(z.string(), z.unknown())).min(1).max(100),
  questions: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
});

export const courseMaterialSyncRequestSchema = z.object({
  bundle: courseMaterialBundleSchema,
  dryRun: z.boolean().default(true),
  publish: z.boolean().default(false),
});
export type CourseMaterialBundle = z.infer<typeof courseMaterialBundleSchema>;

export type CourseMaterialItem = { id: string; filename: string; bytes: number };
