const POINT_LIMIT = 78;
const POINT_COUNT = 2;
const BACK_TOTAL_LIMIT = 170;
const FRONT_LIMIT = 96;

function clipPoint(text: string, limit = POINT_LIMIT): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trim()}…`;
}

export function stripFlashcardPrefixes(text: string): string {
  return text
    .replace(/^Exam focus\s*:\s*/i, "")
    .replace(/^Explain for exams\s*:\s*/i, "")
    .replace(/^In exams, (?:focus on|expect clear points on this topic)\s*:\s*/i, "")
    .trim();
}

/** Topic label for note-style cards (no forced question mark). */
export function briefFlashcardLabel(text: string): string {
  const cleaned = stripFlashcardPrefixes(text).replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= FRONT_LIMIT) return cleaned;
  return clipPoint(cleaned, FRONT_LIMIT);
}

/** Short question side — one line, fits the card. */
export function briefFlashcardFront(text: string): string {
  const cleaned = stripFlashcardPrefixes(text).replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= FRONT_LIMIT) return cleaned;
  const questionMark = cleaned.indexOf("?");
  if (questionMark >= 24 && questionMark < FRONT_LIMIT) return cleaned.slice(0, questionMark + 1);
  const clipped = clipPoint(cleaned, FRONT_LIMIT);
  return clipped.endsWith("?") ? clipped : `${clipped.replace(/[.…]+$/u, "")}?`;
}

/** One idea, or up to two short points. Long notes and stories are not flashcards. */
export function briefFlashcardBack(text: string): string {
  const cleaned = stripFlashcardPrefixes(text);
  if (!cleaned) return "";
  const pieces = cleaned
    .split(/\n+|(?:^|\s)[•]\s+/)
    .map((part) => part.replace(/^(\d+[.)]|[-*])\s+/, "").trim())
    .filter((part) => part.length > 0);
  let source: string[];
  if (pieces.length > 1) {
    source = pieces;
  } else {
    source = [firstSentence(cleaned.replace(/\s+/g, " "))];
  }
  let brief = source
    .slice(0, POINT_COUNT)
    .map((part) => clipPoint(part))
    .filter(Boolean)
    .join("\n");
  if (brief.length > BACK_TOTAL_LIMIT) {
    brief = brief
      .split("\n")
      .map((line) => clipPoint(line, Math.floor(BACK_TOTAL_LIMIT / POINT_COUNT)))
      .join("\n");
  }
  return brief;
}

function firstSentence(text: string): string {
  const sentence = text.split(/(?<=[.!?])\s+/)[0]?.trim();
  return sentence || text;
}

/** Numbered working for a calculation. Ordinary explanations stay as one paragraph. */
export function solutionLines(explanation: string | null | undefined, steps?: string[] | null): string[] {
  const given = (steps ?? []).map((step) => step.trim()).filter(Boolean);
  if (given.length) return given;
  const text = (explanation ?? "").trim();
  if (!text || !/\\\[|\\\(|\bstep\s+\d|[=≈≠≤≥]|[+\-×÷*/]\s*\d|\d+\s*[+\-×÷*/]/i.test(text)) return [];
  const parts = text
    .split(/\n+|(?<=[.!?])\s+(?=(?:Step\s+\d|\d+[.)]\s))|(?<=[.!?])\s+/)
    .map((part) => part.replace(/^\d+[.)]\s*/, "").replace(/^step\s+\d+[:.)-]?\s*/i, "").trim())
    .filter((part) => part.length > 1);
  return parts.length >= 2 ? parts : [];
}
