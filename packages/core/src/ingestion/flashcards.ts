const POINT_LIMIT = 110;
const POINT_COUNT = 3;

function clipPoint(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= POINT_LIMIT) return clean;
  const cut = clean.slice(0, POINT_LIMIT - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 60 ? cut.slice(0, space) : cut).trim()}…`;
}

/** One idea, or up to three short points. Long notes and stories are not flashcards. */
export function briefFlashcardBack(text: string): string {
  const cleaned = text
    .replace(/^Exam focus\s*:\s*/i, "")
    .replace(/^Explain for exams\s*:\s*/i, "")
    .replace(/^In exams, (?:focus on|expect clear points on this topic)\s*:\s*/i, "")
    .trim();
  if (!cleaned) return "";
  const pieces = cleaned
    .split(/\n+|(?:^|\s)[•]\s+/)
    .map((part) => part.replace(/^(\d+[.)]|[-*])\s+/, "").trim())
    .filter((part) => part.length > 0);
  const source = pieces.length > 1 ? pieces : [firstSentence(cleaned.replace(/\s+/g, " "))];
  return source.slice(0, POINT_COUNT).map(clipPoint).filter(Boolean).join("\n");
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
