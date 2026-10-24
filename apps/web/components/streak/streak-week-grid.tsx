import { Check } from "lucide-react";
import type { StreakSnapshot } from "@/lib/streak-week";
import { mondayBasedWeekday, streakActiveDateSet, weekDatesFromLocalDate } from "@/lib/streak-week";

const LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export function StreakWeekGrid({ streak }: { streak: StreakSnapshot }) {
  const activeDates = streakActiveDateSet(streak);
  const weekDates = weekDatesFromLocalDate(streak.local_date);
  const weekday = mondayBasedWeekday(streak.local_date);

  return (
    <ol className="streak-week" aria-label="This week's streak">
      {weekDates.map((date, index) => {
        const complete = activeDates.has(date);
        const isToday = index === weekday;
        const upcoming = index > weekday;
        const status = complete ? "completed" : upcoming ? "upcoming" : "not in current streak";

        return (
          <li
            key={`${date}-${NAMES[index]}`}
            aria-label={`${NAMES[index]}${isToday ? ", today" : ""}: ${status}`}
            aria-current={isToday ? "date" : undefined}
          >
            <span>{LABELS[index]}</span>
            <span className="streak-day" data-complete={complete}>
              {complete ? <Check size={17} strokeWidth={3} aria-hidden /> : <span className="size-1 rounded-full bg-current" />}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
