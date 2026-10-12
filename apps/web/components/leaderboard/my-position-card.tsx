import { Medal } from "lucide-react";
import Link from "next/link";
import type { LeaderboardPage } from "@scholau/api";
import { formatNumber, formatXp } from "@scholau/core";
import { Card, CardContent } from "@/components/ui/card";

export function MyPositionCard({ me, scopeLabel }: { me: LeaderboardPage["me"]; scopeLabel: string }) {
  return (
    <Card tint>
      <CardContent className="flex items-center gap-4 pt-4 sm:pt-6">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-pill bg-surface-card text-brand-primary" aria-hidden>
          <Medal className="size-6" />
        </span>
        {me ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p>
              <span className="text-sm text-ink-muted">Your {scopeLabel.toLowerCase()} rank</span>
              <span className="block text-2xl font-extrabold tabular-nums">{formatNumber(me.rank)}</span>
            </p>
            <p className="text-right">
              <span className="text-sm text-ink-muted">Lifetime XP</span>
              <span className="block text-lg font-bold tabular-nums">{formatXp(me.xp_total)}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            You&apos;re not shown on this leaderboard. If you&apos;ve hidden yourself from leaderboards, you can change that in your{" "}
            <Link href="/profile" className="font-semibold text-brand-primary underline-offset-4 hover:underline">
              profile
            </Link>
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}
