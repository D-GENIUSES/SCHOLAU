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

function isEditorialText(text: string): boolean {
  return /handwritten key|prompts? the key|these prompts are visible|study prompts?|not scored|keyed (?:definition|answer)|answer key/i.test(text);
}

function questionForHeading(heading: string, lessonTitle: string): string {
  const generic = /^(understand the idea|key points|recap|summary|overview|introduction)$/i;
  const topic = (generic.test(heading.trim()) ? lessonTitle : heading).trim().replace(/[.:?]+$/, "");
  if (heading.trim().endsWith("?")) return heading.trim();
  return `How would you explain ${topic}?`;
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
    if (block.type === "paragraph" && block.text.trim() && !isEditorialText(block.text) && !/^[^?]+\?\s*$/.test(block.text)) {
      lines.push(block.text.trim());
    }
    if (block.type === "list") {
      block.items.forEach((item, idx) => {
        if (!isEditorialText(item) && !item.trim().endsWith("?")) lines.push(block.ordered ? `${idx + 1}. ${item}` : `• ${item}`);
      });
    }
    if (block.type === "callout" && block.text.trim() && !isEditorialText(block.text)) {
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
  const { blocks, title, lesson_id: lessonId } = lesson;

  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index];
    if (!block) {
      index += 1;
      continue;
    }
    if (block.type === "heading") {
      const { text, nextIndex } = collectSectionBody(blocks, index + 1);
      if (text && !isEditorialText(block.text)) cards.push({
        id: `${lessonId}-h-${index}`,
        front: questionForHeading(block.text, title),
        back: text,
        tag: "section",
      });
      index = nextIndex;
      continue;
    }
    if (block.type === "checkpoint") {
      const answer = block.options[block.correct_index] ?? "";
      if (answer.trim() && !isEditorialText(block.question)) cards.push({
        id: `${lessonId}-cp-${index}`,
        front: block.question,
        back: answer.trim(),
        tag: "checkpoint",
      });
      index += 1;
      continue;
    }
    if (block.type === "paragraph" && !blocks.some((item) => item.type === "heading") && block.text.trim() && !isEditorialText(block.text) && !block.text.trim().endsWith("?")) {
      cards.push({ id: `${lessonId}-p-${index}`, front: questionForHeading(title, title), back: truncate(block.text), tag: "section" });
    }
    index += 1;
  }

  return cards.filter((card, index) => card.back.trim() && cards.findIndex((other) => other.back === card.back) === index);
}

/** Keep older saved cards consistent with the lesson wording. */
export function lessonCardText(text: string): string {
  return text
    .replace(/^Exam focus\s*:\s*/i, "")
    .replace(/^Explain for exams\s*:\s*/i, "")
    .replace(/^In exams, (?:focus on|expect clear points on this topic)\s*:\s*/i, "")
    .trim();
}
