import type { ReactNode } from "react";
import Link from "next/link";
import type { LeaderboardRow } from "@scholau/api";
import { formatNumber, formatXp } from "@scholau/core";
import { OnlineAvatar } from "@/components/ui/online-avatar";
import { cn } from "@/lib/utils";
import { PodiumMedal, podiumMedalLabel } from "./podium-medal";

/** Server positions include registration-time tie breaking; never sort a single page locally. */
export function LeaderboardList({
  rows,
  label,
  updatedAt,
  scopeBar,
  positionBar,
  readOnly = false,
}: {
  rows: LeaderboardRow[];
  label: string;
  updatedAt?: string;
  scopeBar?: ReactNode;
  positionBar?: ReactNode;
  readOnly?: boolean;
}) {
  return (
    <div className="leaderboard-panel">
    {scopeBar}
    {positionBar}
    <div className="leaderboard-columns" aria-hidden>
      <span>Rank</span>
      <span>{readOnly ? "Student" : "Student · faculty & level"}</span>
      <span className="leaderboard-columns-meta">{updatedAt ? <>XP · {updatedAt}</> : "XP"}</span>
    </div>
    <ol aria-label={label} className="leaderboard-list">
      {rows.map((row, index) => (
        <li key={row.user_id}>
          <LeaderboardRowItem row={row} eager={index < 10} priority={index < 3} readOnly={readOnly} />
        </li>
      ))}
    </ol>
    </div>
  );
}

function LeaderboardRowItem({ row, eager, priority, readOnly }: { row: LeaderboardRow; eager: boolean; priority: boolean; readOnly: boolean }) {
  const medalLabel = podiumMedalLabel(row.rank);
  const podiumPlace = row.rank === 1 || row.rank === 2 || row.rank === 3 ? row.rank : null;
  const avatar = <OnlineAvatar name={row.display_name} path={row.avatar_path} size={32} online={row.online} eager={eager} priority={priority} />;
  const profileHref = `/people/${row.user_id}`;
  return (
    <div
      className={cn(
        "leaderboard-entry",
        row.is_me && "leaderboard-entry-me",
      )}
      data-podium={row.rank <= 3 ? row.rank : undefined}
      aria-current={row.is_me ? "true" : undefined}
    >
      <span className={cn("leaderboard-rank", podiumPlace && "leaderboard-rank-medal")} title={medalLabel}>
        {podiumPlace ? (
          <>
            <span className="sr-only">
              Rank {formatNumber(row.rank)} · {medalLabel}
            </span>
            <PodiumMedal place={podiumPlace} />
          </>
        ) : (
          <>
            <span className="sr-only">Rank </span>
            {formatNumber(row.rank)}
          </>
        )}
      </span>
      {readOnly ? avatar : <Link href={profileHref} className="rounded-full focus-visible:outline-2 focus-visible:outline-brand-primary" aria-label={`View ${row.display_name}'s public profile${row.online ? ", online now" : ""}`}>{avatar}</Link>}
      <div className="leaderboard-identity">
        <div className="leaderboard-name">{readOnly ? <span>{row.display_name}</span> : <Link href={profileHref} className="hover:underline">{row.display_name}</Link>}{row.is_me ? <span className="leaderboard-you">You</span> : null}</div>
        {readOnly ? null : <div className="leaderboard-academic">
          <span>{row.faculty_name ?? "Faculty not set"}</span>
          <span className="leaderboard-level">{row.level_label ?? "Level not set"}</span>
        </div>}
      </div>
      <span className="leaderboard-xp">{formatXp(row.xp_total)}</span>
    </div>
  );
}
