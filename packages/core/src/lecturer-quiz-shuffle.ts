function asOptionIndex(cell: unknown): number | null {
  if (typeof cell === "number" && Number.isInteger(cell)) return cell;
  if (typeof cell === "string" && /^\d+$/.test(cell)) return Number(cell);
  return null;
}

/** Validates per-question option permutations returned from get_course_quiz_v1. */
export function isNestedOptionOrders(orders: unknown, questionCount: number): boolean {
  if (!Array.isArray(orders) || orders.length !== questionCount) return false;
  if (questionCount === 0) return true;
  // Legacy broken shape: flat array of indices (jsonb concat bug).
  if (orders.every(entry => asOptionIndex(entry) !== null)) return false;
  return orders.every(row => Array.isArray(row) && row.length >= 2 && row.every(cell => asOptionIndex(cell) !== null));
}

export function canonicalAnswerToDisplayIndex(perm: unknown[], canonical: number): number | undefined {
  const target = Number(canonical);
  const idx = perm.findIndex(cell => asOptionIndex(cell) === target);
  return idx >= 0 ? idx : undefined;
}
