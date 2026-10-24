/** Matches private.normalize_gap_answer in Postgres (client-side preview before submit). */
export function normalizeGapAnswer(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function dedupeFlashcardsByFront<T extends { front: string }>(cards: T[]): T[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = normalizeGapAnswer(card.front);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
