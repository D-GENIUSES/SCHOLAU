import type { Streak } from "@scholau/api";
import { markStreakCelebrationShown, streakCelebrationAlreadyShown } from "./streak-celebration";

export type StreakCelebrationPayload = {
  days: number;
  localDate: string;
  previousDays: number;
};

type Listener = (payload: StreakCelebrationPayload) => void;
const listeners = new Set<Listener>();

export function subscribeStreakCelebration(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitStreakCelebration(owner: string, payload: StreakCelebrationPayload): void {
  if (streakCelebrationAlreadyShown(owner, payload.localDate)) return;
  markStreakCelebrationShown(owner, payload.localDate);
  listeners.forEach((listener) => listener(payload));
}

export function streakAdvanced(previous: Streak | undefined, next: Streak): boolean {
  if (!next.active_today || next.current < 1) return false;
  if (!previous) return true;
  return !previous.active_today || previous.local_date !== next.local_date || next.current > previous.current;
}

export function celebrationPayload(previous: Streak | undefined, next: Streak): StreakCelebrationPayload {
  const previousDays = previous?.active_today && previous.local_date === next.local_date
    ? Math.min(previous.current, next.current)
    : Math.max(0, next.current - 1);
  return { days: next.current, localDate: next.local_date, previousDays };
}
