import type { CompleteLessonResult } from "@scholau/api";

/** Each newly completed lesson celebrates the confirmed streak, without incrementing it. */
export function shouldCelebrateStreak(result: CompleteLessonResult): boolean {
  return !result.already_completed && result.streak.active_today && result.streak.current > 0;
}
