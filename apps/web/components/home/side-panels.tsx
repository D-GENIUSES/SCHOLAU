"use client";

import { Flame, Star, Swords, Zap } from "lucide-react";
import Link from "next/link";
import type { HomeSummary } from "@scholau/api";
import { COPY, formatStreak, formatXp } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, Stat } from "@/components/ui/misc";

export function StatsPanel({ summary }: { summary: HomeSummary }) {
  const { streak } = summary;
  return (
    <section aria-labelledby="stats-title" className="flex flex-col gap-3">
      <h2 id="stats-title" className="sr-only">
        Your stats
      </h2>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Stat label="Total XP" value={formatXp(summary.xp_total)} icon={<Star className="size-5" />} />
        <div className="flex flex-col gap-1">
          <Stat label="Streak" value={formatStreak(streak.current)} icon={<Flame className="size-5" />} />
          <p className="px-1 text-sm text-ink-muted">{streak.active_today ? "Active today" : "Not active yet today"}</p>
        </div>
      </div>
    </section>
  );
}

export function LearningXpCard({ today, cap }: { today: number; cap: number | null }) {
  const reached = cap !== null && today >= cap;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <Zap className="size-5 text-brand-primary" aria-hidden />
          Learning XP today
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {cap !== null ? (
          <>
            <p className="font-semibold text-ink">
              {formatXp(today)} of {formatXp(cap)}
            </p>
            <Progress value={cap > 0 ? (100 * today) / cap : 0} label="Learning XP earned today" tone={reached ? "success" : "brand"} />
            {reached ? (
              <div className="flex flex-col gap-1 pt-1">
                <p className="text-sm text-ink">{COPY.learning.capReached}</p>
                <p className="text-sm text-ink-muted">{COPY.learning.capReset}</p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="font-semibold text-ink">{formatXp(today)} earned from learning today</p>
        )}
      </CardContent>
    </Card>
  );
}

export function BattleCard({ live }: { live: HomeSummary["live_battle"] }) {
  const resumeHref = live?.battle_id ? `/battles/${live.battle_id}` : live?.queue_id ? "/battles/queue" : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <Swords className="size-5 text-brand-primary" aria-hidden />
          Battles
        </CardTitle>
        <CardDescription>{COPY.battle.unlimited}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-ink-muted">{resumeHref ? "You have a battle in progress." : COPY.battle.rewards}</p>
      </CardContent>
      <CardFooter>
        {resumeHref ? (
          <Button asChild>
            <Link href={resumeHref}>Resume your battle</Link>
          </Button>
        ) : (
          <Button asChild variant="secondary">
            <Link href="/battles">Find a battle</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
