import { Medal } from "lucide-react";
import Link from "next/link";
import type { LeaderboardPage } from "@scholau/api";
import { formatNumber, formatXp } from "@scholau/core";
import { Card, CardContent } from "@/components/ui/card";

export function MyPositionCard({ me, scopeLabel }: { me: LeaderboardPage["me"]; scopeLabel: string }) {
  return (
    <Card className="leaderboard-position">
      <CardContent className="flex items-center gap-3 p-4 sm:p-4">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white" aria-hidden>
          <Medal className="size-6" />
        </span>
        {me ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p>
              <span className="text-xs text-blue-100">Your {scopeLabel.toLowerCase()} rank</span>
              <span className="block text-2xl font-extrabold tabular-nums">{formatNumber(me.rank)}</span>
            </p>
            <p className="text-right">
              <span className="text-xs text-blue-100">Lifetime XP</span>
              <span className="block text-lg font-bold tabular-nums">{formatXp(me.xp_total)}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-blue-50">
            You&apos;re not shown on this leaderboard. If you&apos;ve hidden yourself from leaderboards, you can change that in your{" "}
            <Link href="/profile" className="font-semibold text-white underline underline-offset-4">
              profile
            </Link>
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}
