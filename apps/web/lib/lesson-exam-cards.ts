import type { LessonBlock } from "@scholau/core";

export type ExamFlashcard = {
  id: string;
  front: string;
  back: string;
  tag?: "focus" | "section" | "tip" | "checkpoint" | "diagram" | "recap";
  imagePath?: string;
  imageAlt?: string;
};

export type LessonFlashcardInput = {
  lesson_id: string;
  title: string;
  objective: string;
  blocks: LessonBlock[];
};

const MAX_BACK_CHARS = 520;

function truncate(text: string, max = MAX_BACK_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function firstParagraph(blocks: LessonBlock[]): string | null {
  for (const block of blocks) {
    if (block.type === "paragraph" && block.text.trim()) return block.text.trim();
  }
  return null;
}

function examPromptForHeading(title: string, level?: 2 | 3 | 4): string {
  const t = title.trim();
  const lower = t.toLowerCase();
  if (/^(list|types of|steps|features)/.test(lower)) return `List: ${t}`;
  if (/^(compare|difference|vs\.?)/.test(lower)) return `Compare / contrast: ${t}`;
  if (level === 4) return `Recall: ${t}`;
  return t;
}

function isSectionBreak(block: LessonBlock): boolean {
  return (
    block.type === "heading" ||
    block.type === "checkpoint" ||
    block.type === "image" ||
    (block.type === "callout" && (block.tone === "tip" || block.tone === "warning"))
  );
}

function collectSectionBody(blocks: LessonBlock[], start: number): { text: string; nextIndex: number } {
  const lines: string[] = [];
  let i = start;
  while (i < blocks.length) {
    const block = blocks[i];
    if (!block || isSectionBreak(block)) break;
    if (block.type === "paragraph" && block.text.trim()) {
      lines.push(block.text.trim());
    }
    if (block.type === "list") {
      block.items.forEach((item, idx) => {
        lines.push(block.ordered ? `${idx + 1}. ${item}` : `• ${item}`);
      });
    }
    if (block.type === "callout" && block.text.trim()) {
      lines.push(block.text.trim());
    }
    if (block.type === "code" && block.code.trim()) {
      lines.push(`Code (${block.language ?? "snippet"}): ${block.code.trim().slice(0, 120)}`);
    }
    i += 1;
  }
  const joined = lines.join("\n\n");
  const back = joined;
  return { text: truncate(back), nextIndex: i };
}

export function buildExamFlashcards(lesson: LessonFlashcardInput): ExamFlashcard[] {
  const cards: ExamFlashcard[] = [];
  const { blocks, title, objective, lesson_id: lessonId } = lesson;

  const gist = objective.trim() || firstParagraph(blocks);
  if (gist) cards.push({
    id: `${lessonId}-focus`,
    front: title,
    back: truncate(gist),
    tag: "focus",
  });

  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index];
    if (!block) {
      index += 1;
      continue;
    }
    if (block.type === "heading") {
      const { text, nextIndex } = collectSectionBody(blocks, index + 1);
      if (text) cards.push({
        id: `${lessonId}-h-${index}`,
        front: examPromptForHeading(block.text, block.level),
        back: text,
        tag: "section",
      });
      index = nextIndex;
      continue;
    }
    if (block.type === "checkpoint") {
      const answer = block.options[block.correct_index] ?? "";
      cards.push({
        id: `${lessonId}-cp-${index}`,
        front: block.question,
        back: truncate(`Answer: ${answer}\n\n${block.explanation}`),
        tag: "checkpoint",
      });
      index += 1;
      continue;
    }
    if (block.type === "image") {
      cards.push({
        id: `${lessonId}-img-${index}`,
        front: block.caption?.trim() || `Diagram: ${block.alt}`,
        back: truncate(block.caption?.trim() || block.alt),
        tag: "diagram",
        imagePath: block.path,
        imageAlt: block.alt,
      });
      index += 1;
      continue;
    }
    if (block.type === "paragraph" && !blocks.some((item) => item.type === "heading") && block.text.trim()) {
      cards.push({ id: `${lessonId}-p-${index}`, front: title, back: truncate(block.text), tag: "section" });
    }
    index += 1;
  }

  return cards.filter((card, index) => card.back.trim() && cards.findIndex((other) => other.back === card.back) === index);
}
