import Link from "next/link";
import type { LeaderboardRow } from "@scholau/api";
import { formatNumber, formatXp } from "@scholau/core";
import { Avatar } from "@/components/ui/avatar";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

const podiumMedals: Record<number, { symbol: string; label: string }> = {
  1: { symbol: "🥇", label: "Gold medal" },
  2: { symbol: "🥈", label: "Silver medal" },
  3: { symbol: "🥉", label: "Bronze medal" },
};

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
  const medal = podiumMedals[row.rank];
  return (
    <div
      className={cn(
        "leaderboard-entry",
        row.is_me && "leaderboard-entry-me",
      )}
      data-podium={row.rank <= 3 ? row.rank : undefined}
      aria-current={row.is_me ? "true" : undefined}
    >
      <span className="leaderboard-rank" title={medal?.label}>
        {medal ? <><span className="sr-only">Rank {formatNumber(row.rank)} · {medal.label}</span><span aria-hidden className="text-[23px] leading-none">{medal.symbol}</span></> : <><span className="sr-only">Rank </span>{formatNumber(row.rank)}</>}
      </span>
      <Link href={`/people/${row.user_id}`} className="rounded-full focus-visible:outline-2 focus-visible:outline-brand-primary" aria-label={`View ${row.display_name}'s public profile`}><Avatar name={row.display_name} path={row.avatar_path} size={32} publicProfile /></Link>
      <div className="leaderboard-identity">
        <div className="leaderboard-name"><Link href={`/people/${row.user_id}`} className="hover:underline">{row.display_name}</Link>{row.is_me ? <span className="leaderboard-you">You</span> : null}</div>
        <div className="leaderboard-academic">
          <span><GraduationCap className="size-3" aria-hidden />{row.faculty_name ?? "Faculty not set"}</span>
          <span className="leaderboard-level">{row.level_label ?? "Level not set"}</span>
        </div>
      </div>
      <span className="leaderboard-xp">{formatXp(row.xp_total)}</span>
    </div>
  );
}
