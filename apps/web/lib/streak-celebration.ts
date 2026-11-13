import type { CompleteLessonResult } from "@scholau/api";

const STORAGE_PREFIX = "scholau.streak-celebration.v1:";

/** Each newly completed lesson celebrates the confirmed streak, without incrementing it. */
export function shouldCelebrateStreak(result: CompleteLessonResult): boolean {
  return !result.already_completed && result.streak.active_today && result.streak.current > 0;
}

export function streakCelebrationStorageKey(owner: string): string {
  return `${STORAGE_PREFIX}${owner}`;
}

/** Device-local throttle: one celebration animation per user per calendar streak day. */
export function streakCelebrationAlreadyShown(owner: string, localDate: string): boolean {
  if (!owner || !localDate) return true;
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(streakCelebrationStorageKey(owner)) === localDate;
  } catch {
    return false;
  }
}

export function markStreakCelebrationShown(owner: string, localDate: string): void {
  if (!owner || !localDate || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(streakCelebrationStorageKey(owner), localDate);
  } catch {
    // Storage restrictions must not block learning completions.
  }
}
