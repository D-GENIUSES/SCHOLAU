/** Fisher–Yates copy. Display order must not follow a stored A/B/C/D answer key. */
export function shuffleItems<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = current;
  }
  return copy;
}

export function shuffleIndexedChoices<T>(options: readonly T[], correctIndex: number, random: () => number = Math.random) {
  const order = shuffleItems(options.map((_, index) => index), random);
  return {
    options: order.map((index) => options[index]!),
    correctIndex: order.indexOf(correctIndex),
  };
}
