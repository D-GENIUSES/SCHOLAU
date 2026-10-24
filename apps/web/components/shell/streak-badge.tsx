import { StreakFlame } from "@/components/icons/streak-flame";

export function StreakBadge({ current, activeToday }: { current: number; activeToday: boolean }) {
  return (
    <span
      className="header-streak"
      data-active={activeToday}
      role="status"
      aria-label={`${current}-day streak${activeToday ? ", active today" : ""}`}
    >
      <StreakFlame active={activeToday} size={22} />
      <span key={current} className="streak-count">
        {current}
      </span>
    </span>
  );
}
