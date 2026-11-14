import { briefFlashcardBack, briefFlashcardLabel, type LessonBlock } from "@scholau/core";

export const MAX_LESSON_FLASHCARDS = 10;

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

function collectSectionLines(blocks: LessonBlock[], start: number): { lines: string[]; nextIndex: number } {
  const lines: string[] = [];
  let i = start;
  while (i < blocks.length) {
    const block = blocks[i];
    if (!block || isSectionBreak(block)) break;
    if (block.type === "paragraph" && block.text.trim() && !isSkippedBodyLine(block.text)) {
      lines.push(block.text.trim());
    }
    if (block.type === "list") {
      block.items.forEach((item) => {
        if (!isSkippedBodyLine(item)) lines.push(item.trim());
      });
    }
    if (block.type === "callout" && block.text.trim() && block.tone !== "tip" && block.tone !== "warning" && !isEditorialText(block.text)) {
      lines.push(block.text.trim());
    }
    if (block.type === "code" && block.code.trim()) {
      lines.push(`Code: ${block.code.trim().slice(0, 100)}`);
    }
    i += 1;
  }
  return { lines, nextIndex: i };
}

function pushUnique(cards: ExamFlashcard[], card: ExamFlashcard, max = MAX_LESSON_FLASHCARDS): boolean {
  if (cards.length >= max || !card.back.trim() || !card.front.trim()) return false;
  if (cards.some((other) => other.back === card.back && other.front === card.front)) return false;
  cards.push(card);
  return true;
}

function isDefinitionLine(text: string): boolean {
  return /\b(is|are|means|refers to|defined as)\b/i.test(text);
}

function summarizeExamBack(lines: string[], role?: "definition" | "recap"): string {
  if (!lines.length) return "";
  const clean = lines.map((line) => line.trim()).filter(Boolean);
  if (!clean.length) return "";

  if (clean.length === 1) {
    const brief = briefFlashcardBack(clean[0]!);
    if (!brief) return "";
    if (role === "recap" && !/^exam\b/i.test(brief)) return briefFlashcardBack(`Exam focus: ${brief}`);
    return brief;
  }

  const listItems = clean.filter((line) => line.split(/\s+/).length <= 4);
  const prose = clean.filter((line) => line.split(/\s+/).length > 4);
  if (listItems.length >= 2) {
    const lead = prose.find((line) => isDefinitionLine(line)) ?? prose[0];
    const itemLine = briefFlashcardBack(listItems.join("; "));
    if (!lead) return itemLine;
    return briefFlashcardBack(`${briefFlashcardBack(lead)}\n${itemLine}`);
  }

  const definition = clean.find((line) => isDefinitionLine(line)) ?? clean[0]!;
  const joined = briefFlashcardBack([definition, clean.find((line) => line !== definition)].filter(Boolean).join(" "));
  return joined;
}

function appendTopicNotes(
  cards: ExamFlashcard[],
  lessonId: string,
  topic: string,
  lines: string[],
  tag: ExamFlashcard["tag"],
  idPrefix: string,
  role?: "definition" | "recap",
): void {
  const back = summarizeExamBack(lines, role);
  if (!back) return;
  pushUnique(cards, {
    id: `${lessonId}-${idPrefix}`,
    front: topic,
    back,
    tag,
  });
}

export function buildExamFlashcards(lesson: LessonFlashcardInput): ExamFlashcard[] {
  const cards: ExamFlashcard[] = [];
  const { blocks, title, lesson_id: lessonId, objective } = lesson;
  let sectionTopic = briefFlashcardLabel(title);
  let index = 0;

  if (objective.trim() && !isEditorialText(objective)) {
    const objectiveBack = briefFlashcardBack(
      isDefinitionLine(objective) ? objective : `Key point: ${objective}`,
    );
    pushUnique(cards, {
      id: `${lessonId}-objective`,
      front: briefFlashcardLabel(title),
      back: objectiveBack,
      tag: "focus",
    });
  }

  while (index < blocks.length && cards.length < MAX_LESSON_FLASHCARDS) {
    const block = blocks[index];
    if (!block) {
      index += 1;
      continue;
    }

    if (block.type === "heading" && !isEditorialText(block.text)) {
      sectionTopic = sectionTopicLabel(block.text, title);
      const { lines, nextIndex } = collectSectionLines(blocks, index + 1);
      const recap = /^(what to remember|recap|summary)$/i.test(block.text.trim());
      appendTopicNotes(cards, lessonId, sectionTopic, lines, recap ? "recap" : "section", `h-${index}`, recap ? "recap" : "definition");
      index = nextIndex;
      continue;
    }

    if (block.type === "callout" && (block.tone === "tip" || block.tone === "warning") && block.text.trim() && !isEditorialText(block.text)) {
      const prefix = block.tone === "warning" ? "Common mistake: " : "Exam tip: ";
      const body = block.text.trim().replace(/^(common mistake|exam tip)\s*:\s*/i, "");
      pushUnique(cards, {
        id: `${lessonId}-${block.tone}-${index}`,
        front: sectionTopic || briefFlashcardLabel(block.tone === "warning" ? "Common mistake" : "Exam tip"),
        back: briefFlashcardBack(`${prefix}${body}`),
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
      appendTopicNotes(cards, lessonId, briefFlashcardLabel(title), [block.text.trim()], "section", `p-${index}`);
    }

    index += 1;
  }

  return cards.slice(0, MAX_LESSON_FLASHCARDS);
}

/** Keep older saved cards consistent with the lesson wording. */
export function lessonCardText(text: string): string {
  return briefFlashcardLabel(text);
}
