import type { LeaderboardRow } from "@scholau/api";
import { formatNumber, formatXp } from "@scholau/core";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

/** Ranked rows exactly as returned by the server (ties share a rank; never recomputed). */
export function LeaderboardList({ rows, label }: { rows: LeaderboardRow[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.user_id}>
          <LeaderboardRowItem row={row} />
        </li>
      ))}
    </ol>
  );
}

function LeaderboardRowItem({ row }: { row: LeaderboardRow }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-card border bg-surface-card p-3 sm:p-4",
        row.is_me ? "border-brand-primary bg-surface-tint" : "border-line",
      )}
      aria-current={row.is_me ? "true" : undefined}
    >
      <span className="w-12 shrink-0 text-center text-lg font-extrabold tabular-nums text-ink">
        <span className="sr-only">Rank </span>
        {formatNumber(row.rank)}
      </span>
      <Avatar name={row.display_name} path={row.avatar_path} size={32} />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-semibold">{row.display_name}</span>
        {row.is_me ? <Badge tone="brand">You</Badge> : null}
      </span>
      <span className="shrink-0 font-bold tabular-nums">{formatXp(row.xp_total)}</span>
    </div>
  );
}
