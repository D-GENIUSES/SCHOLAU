import type { LeaderboardRow } from "@scholau/api";
import { formatNumber, formatXp } from "@scholau/core";
import { Avatar } from "@/components/ui/avatar";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/** Server positions include registration-time tie breaking; never sort a single page locally. */
export function LeaderboardList({ rows, label }: { rows: LeaderboardRow[]; label: string }) {
  return (
    <div className="leaderboard-panel">
    <div className="leaderboard-columns" aria-hidden><span>Rank</span><span>Student · faculty & level</span><span>XP</span></div>
    <ol aria-label={label} className="leaderboard-list">
      {rows.map((row) => (
        <li key={row.user_id}>
          <LeaderboardRowItem row={row} />
        </li>
      ))}
    </ol>
    </div>
  );
}

function LeaderboardRowItem({ row }: { row: LeaderboardRow }) {
  return (
    <div
      className={cn(
        "leaderboard-entry",
        row.is_me && "leaderboard-entry-me",
      )}
      data-podium={row.rank <= 3 ? row.rank : undefined}
      aria-current={row.is_me ? "true" : undefined}
    >
      <span className="leaderboard-rank">
        <span className="sr-only">Rank </span>
        {formatNumber(row.rank)}
      </span>
      <Avatar name={row.display_name} path={row.avatar_path} size={32} />
      <div className="leaderboard-identity">
        <div className="leaderboard-name"><span>{row.display_name}</span>{row.is_me ? <span className="leaderboard-you">You</span> : null}</div>
        <div className="leaderboard-academic">
          <span><GraduationCap className="size-3" aria-hidden />{row.faculty_name ?? "Faculty not set"}</span>
          <span className="leaderboard-level">{row.level_label ?? "Level not set"}</span>
        </div>
      </div>
      <span className="leaderboard-xp">{formatXp(row.xp_total)}</span>
    </div>
  );
}
