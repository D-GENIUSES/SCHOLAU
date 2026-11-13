import { briefFlashcardBack, briefFlashcardLabel, type LessonBlock } from "@scholau/core";

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

function isEditorialText(text: string): boolean {
  return /handwritten key|prompts? the key|these prompts are visible|study prompts?|not scored|keyed (?:definition|answer)|answer key|according to (?:the )?(?:textbook|reading|source)|(?:©|copyright)|all rights reserved|pp\.\s*\d|chapter \d+ (?:of|from)|as (?:shown|described) (?:in|on) (?:the )?(?:figure|diagram|slide)|outside (?:the )?(?:course|lesson)|source material|verbatim from/i.test(
    text,
  );
}

function isSkippedBodyLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || isEditorialText(trimmed)) return true;
  if (/^how would you explain\b/i.test(trimmed)) return true;
  if (/^[^.!?]{8,}\?\s*$/.test(trimmed)) return true;
  return false;
}

function sectionTopicLabel(heading: string, lessonTitle: string): string {
  const generic = /^(understand the idea|key points|recap|summary|overview|introduction)$/i;
  const topic = (generic.test(heading.trim()) ? lessonTitle : heading).trim().replace(/[.:?]+$/, "");
  return briefFlashcardLabel(topic);
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
    if (block.type === "paragraph" && block.text.trim() && !isSkippedBodyLine(block.text)) {
      lines.push(block.text.trim());
    }
    if (block.type === "list") {
      block.items.forEach((item, idx) => {
        if (!isSkippedBodyLine(item)) lines.push(block.ordered ? `${idx + 1}. ${item}` : `• ${item}`);
      });
    }
    if (block.type === "callout" && block.text.trim() && block.tone !== "tip" && block.tone !== "warning" && !isEditorialText(block.text)) {
      lines.push(block.text.trim());
    }
    if (block.type === "code" && block.code.trim()) {
      lines.push(briefFlashcardBack(`Code: ${block.code.trim().slice(0, 100)}`));
    }
    i += 1;
  }
  const joined = lines.join("\n");
  return { text: briefFlashcardBack(joined), nextIndex: i };
}

function pushUnique(cards: ExamFlashcard[], card: ExamFlashcard) {
  if (!card.back.trim() || !card.front.trim()) return;
  if (cards.some((other) => other.back === card.back && other.front === card.front)) return;
  cards.push(card);
}

export function buildExamFlashcards(lesson: LessonFlashcardInput): ExamFlashcard[] {
  const cards: ExamFlashcard[] = [];
  const { blocks, title, lesson_id: lessonId } = lesson;
  let sectionTopic = briefFlashcardLabel(title);
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    if (!block) {
      index += 1;
      continue;
    }

    if (block.type === "heading" && !isEditorialText(block.text)) {
      sectionTopic = sectionTopicLabel(block.text, title);
      const { text, nextIndex } = collectSectionBody(blocks, index + 1);
      if (text) {
        pushUnique(cards, { id: `${lessonId}-h-${index}`, front: sectionTopic, back: text, tag: "section" });
      }
      index = nextIndex;
      continue;
    }

    if (block.type === "callout" && (block.tone === "tip" || block.tone === "warning") && block.text.trim() && !isEditorialText(block.text)) {
      pushUnique(cards, {
        id: `${lessonId}-tip-${index}`,
        front: sectionTopic || briefFlashcardLabel("Exam tip"),
        back: briefFlashcardBack(block.text),
        tag: "tip",
      });
      index += 1;
      continue;
    }

    if (block.type === "checkpoint") {
      const note = (block.explanation?.trim() || block.options[block.correct_index]?.trim() || "").trim();
      if (note && !isEditorialText(note)) {
        pushUnique(cards, {
          id: `${lessonId}-cp-${index}`,
          front: sectionTopic || briefFlashcardLabel("Exam tip"),
          back: briefFlashcardBack(note),
          tag: "tip",
        });
      }
      index += 1;
      continue;
    }

    if (
      block.type === "paragraph" &&
      !blocks.some((item) => item.type === "heading") &&
      block.text.trim() &&
      !isSkippedBodyLine(block.text)
    ) {
      pushUnique(cards, {
        id: `${lessonId}-p-${index}`,
        front: briefFlashcardLabel(title),
        back: briefFlashcardBack(block.text),
        tag: "section",
      });
    }

    index += 1;
  }

  return cards;
}

/** Keep older saved cards consistent with the lesson wording. */
export function lessonCardText(text: string): string {
  return briefFlashcardLabel(text);
}
