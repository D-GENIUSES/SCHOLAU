import type { Streak } from "@scholau/api";

export type StreakSnapshot = Pick<Streak, "current" | "longest" | "active_today" | "local_date">;

/** Monday = 0 … Sunday = 6 for a Lagos calendar date (YYYY-MM-DD). */
export function mondayBasedWeekday(localDate: string): number {
  return (new Date(`${localDate}T12:00:00Z`).getUTCDay() + 6) % 7;
}

export function weekDatesFromLocalDate(localDate: string): string[] {
  const weekday = mondayBasedWeekday(localDate);
  const monday = new Date(`${localDate}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - weekday);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

/** Calendar dates included in the user's current consecutive streak. */
export function streakActiveDateSet(streak: StreakSnapshot): Set<string> {
  const dates = new Set<string>();
  if (streak.current <= 0) return dates;

  const end = new Date(`${streak.local_date}T12:00:00Z`);
  if (!streak.active_today) {
    end.setUTCDate(end.getUTCDate() - 1);
  }

  for (let index = 0; index < streak.current; index += 1) {
    const day = new Date(end);
    day.setUTCDate(day.getUTCDate() - index);
    dates.add(day.toISOString().slice(0, 10));
  }
  return dates;
}

export function streakStatusMessage(streak: StreakSnapshot): string {
  if (streak.current <= 0) {
    return "Complete a lesson today to start your streak.";
  }
  if (streak.active_today) {
    return streak.current === 1
      ? "Your streak started today. Come back tomorrow to keep it going."
      : "You studied today. Keep showing up every day to grow your streak.";
  }
  return `Complete a lesson today to keep your ${streak.current}-day streak.`;
}
