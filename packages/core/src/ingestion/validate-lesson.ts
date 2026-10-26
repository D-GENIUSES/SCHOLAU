import type { LessonBlock } from "../domain";

/** Mirrors admin_sync / validate_lesson_blocks teaching requirements for ingestion output. */
export function validateTeachingLessonBlocks(blocks: LessonBlock[]): string[] {
  const errors: string[] = [];
  if (!blocks.length) errors.push("blocks must not be empty");
  const hasCheckpoint = blocks.some((b) => b.type === "checkpoint");
  const hasExample = blocks.some((b) => b.type === "worked_example" || (b.type === "callout" && b.tone === "example"));
  const hasLongParagraph = blocks.some((b) => b.type === "paragraph" && b.text.length >= 80);
  if (!hasCheckpoint) errors.push("lesson needs a checkpoint block");
  if (!hasExample) errors.push("lesson needs a worked example or example callout");
  if (!hasLongParagraph) errors.push("lesson needs a paragraph of at least 80 characters");
  return errors;
}
