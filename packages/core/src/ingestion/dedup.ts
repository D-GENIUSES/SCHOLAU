import { createHash } from "node:crypto";

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function contentFingerprint(normalizedText: string): string {
  return createHash("sha256").update(normalizedText.trim().toLowerCase()).digest("hex");
}

export function normalizePromptKey(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

export function promptHash(prompt: string): string {
  return createHash("sha256").update(normalizePromptKey(prompt)).digest("hex");
}

export function stableLogicalKey(courseCode: string, sourceSha: string, page: number, seq: number): string {
  const prefix = sourceSha.slice(0, 12);
  const code = courseCode.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${code}-mat-${prefix}-p${page}-c${seq}`;
}
