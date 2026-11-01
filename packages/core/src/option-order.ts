/** Stable option order so a printed answer key is not the order students see. */

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffledCopy<T>(items: readonly T[], seed: string): T[] {
  const copy = items.slice();
  let state = hashSeed(seed) || 1;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

export function displayOptionOrder<T extends { id: string }>(options: readonly T[]): T[] {
  if (options.length < 2) return options.slice();
  return shuffledCopy(options, options.map((option) => option.id).sort().join("|"));
}
