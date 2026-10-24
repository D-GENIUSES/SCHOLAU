import type { CompleteLessonResult, Streak } from "@scholau/api";

/** Celebrate confirmed daily progress, including restarting after a missed day. */
export function shouldCelebrateStreak(result: CompleteLessonResult, previous?: Streak): boolean {
  if (result.already_completed || !result.streak.active_today || result.streak.current < 1) return false;
  return Boolean(result.first_lesson_completed || (previous && (
    !previous.active_today || previous.local_date !== result.streak.local_date || result.streak.current > previous.current
  )));
}
