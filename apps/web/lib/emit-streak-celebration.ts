import type { Streak } from "@scholau/api";
import { celebrationPayload, emitStreakCelebration, streakAdvanced } from "@/lib/streak-celebration-bus";

/** Server-confirmed streak change after quiz, battle, or other learning activity. */
export function emitStreakCelebrationIfAdvanced(
  owner: string | undefined,
  previous: Streak | undefined,
  next: Streak | undefined,
): void {
  if (!owner || !next || !next.active_today || next.current < 1) return;
  if (!streakAdvanced(previous, next)) return;
  emitStreakCelebration(owner, celebrationPayload(previous, next));
}