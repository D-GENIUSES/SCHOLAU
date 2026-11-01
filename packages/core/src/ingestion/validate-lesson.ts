import type { LessonBlock } from "../domain";

const PARAGRAPH_MAX = 600;

export function isQuantitativeCourse(courseCode: string): boolean {
  return /^(MTH|STA|STT|MAT|PHY|CHM)\b/i.test(courseCode.trim());
}

/** Mirrors admin_sync / validate_lesson_blocks teaching requirements for ingestion output. */
export function validateTeachingLessonBlocks(
  blocks: LessonBlock[],
  options?: { courseCode?: string },
): string[] {
  const errors: string[] = [];
  if (!blocks.length) errors.push("blocks must not be empty");
  const quantitative = options?.courseCode ? isQuantitativeCourse(options.courseCode) : false;

  const checkpoints = blocks.filter((b) => b.type === "checkpoint");
  const hasExample = blocks.some(
    (b) => b.type === "worked_example" || (b.type === "callout" && b.tone === "example"),
  );
  const hasLongParagraph = blocks.some((b) => b.type === "paragraph" && b.text.length >= 80);

  const minCheckpoints = quantitative ? 2 : 1;
  if (checkpoints.length < minCheckpoints) {
    errors.push(`lesson needs at least ${minCheckpoints} checkpoint block(s)`);
  }
  if (!hasExample) errors.push("lesson needs a worked example or example callout");
  if (!hasLongParagraph) errors.push("lesson needs a paragraph of at least 80 characters");

  if (quantitative) {
    const worked = blocks.find((b) => b.type === "worked_example");
    if (!worked || worked.type !== "worked_example" || worked.steps.length < 3) {
      errors.push("quantitative lesson needs a worked_example with at least 3 steps");
    }
  }

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (!block || block.type !== "paragraph" || block.text.length <= PARAGRAPH_MAX) continue;
    const next = blocks[i + 1];
    const splitFollows = next && (next.type === "list" || next.type === "equation" || next.type === "worked_example");
    if (!splitFollows) {
      errors.push(`paragraph ${i + 1} is too long; split with headings, lists, or equations`);
    }
  }

  return errors;
}

type BattleQuestionCheck = {
  answer_format?: string;
  correct_option?: string;
  options?: readonly { label: string; steps?: readonly string[] | undefined }[] | undefined;
};

export function validateIngestionBattleQuestions(questions: readonly BattleQuestionCheck[]): string[] {
  const errors: string[] = [];
  questions.forEach((q, i) => {
    if (q.answer_format !== "worked_solution" || !q.options) return;
    const correct = q.correct_option?.toUpperCase();
    const correctOpt = q.options.find((o) => o.label.toUpperCase() === correct);
    if (!correctOpt?.steps?.length) {
      errors.push(`battle question ${i + 1}: correct option must include steps[]`);
    }
  });
  return errors;
}
