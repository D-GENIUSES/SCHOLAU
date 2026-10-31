import type { LessonBlock } from "@scholau/core";

export type LessonStep = {
  id: string;
  title: string;
  blocks: LessonBlock[];
};

/** Split lesson blocks into steps at level-2 headings (fallback: one step for the whole lesson). */
export function splitLessonIntoSteps(blocks: LessonBlock[]): LessonStep[] {
  if (!blocks.length) return [];
  const hasSectionHeadings = blocks.some((b) => b.type === "heading" && (b.level ?? 2) <= 2);
  if (!hasSectionHeadings) {
    return [{ id: "step-0", title: "Lesson", blocks }];
  }

  const steps: LessonStep[] = [];
  let current: LessonBlock[] = [];
  let title = "Introduction";
  let index = 0;

  const push = () => {
    if (!current.length) return;
    steps.push({ id: `step-${index}`, title, blocks: current });
    index += 1;
    current = [];
  };

  for (const block of blocks) {
    if (block.type === "heading" && (block.level ?? 2) <= 2) {
      push();
      title = block.text.trim() || `Section ${index + 1}`;
      current = [block];
    } else {
      current.push(block);
    }
  }
  push();
  return steps.length ? steps : [{ id: "step-0", title: "Lesson", blocks }];
}
