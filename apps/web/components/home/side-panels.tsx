import Link from "next/link";
import { Flame, Star } from "lucide-react";
import type { HomeSummary } from "@scholau/api";
import { COPY, formatStreak, formatXp } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { StreakShare } from "@/components/home/streak-share";

export function StatsPanel({ summary }: { summary: Pick<HomeSummary, "streak" | "xp_total"> }) {
  return (
    <section aria-label="Your progress" className="home-stats">
      <div className="home-stat"><Star className="stat-star" size={21} aria-hidden /><div><strong>{formatXp(summary.xp_total)}</strong><small>Total XP</small></div></div>
      <div className="home-stat"><Flame className="stat-flame" size={21} aria-hidden /><div><strong>{formatStreak(summary.streak.current)}</strong><small>Current streak</small></div></div>
    </section>
  );
}

export function LearningXpCard({ today, cap }: { today: number; cap: number | null }) {
  const reached = cap !== null && today >= cap;
  return (
    <Card className="daily-progress">
      <CardHeader><CardTitle>Learning XP today</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{formatXp(today)}{cap !== null ? ` of ${formatXp(cap)}` : " earned from learning"}</p>
        {cap !== null ? <Progress value={cap > 0 ? 100 * today / cap : 0} label="Learning XP earned today" tone={reached ? "success" : "brand"} className="h-1.5" /> : null}
        <p className="text-sm text-ink-muted">{reached ? `${COPY.learning.capReached} ${COPY.learning.capReset}` : "XP earned from knowledge checks and assessments."}</p>
      </CardContent>
    </Card>
  );
}

export function BattleCard({ live, guest = false }: { live: HomeSummary["live_battle"]; guest?: boolean }) {
  const resumeHref = live?.battle_id ? `/battles/${live.battle_id}` : live?.queue_id ? "/battles/queue" : null;
  return (
    <section className="battle-spotlight" aria-label="Quiz battles">
      <div className="battle-content">
        <h2>{resumeHref ? "Battle in progress" : "Quiz battles"}</h2>
        <p className="battle-benefit">Unlimited battles</p>
        <p className="battle-benefit">XP for accuracy and results</p>
        <Button asChild size="sm" className="mt-3 self-start">
          <Link href={guest ? "/home?view=battles" : resumeHref ?? "/battles"}>{resumeHref ? "Resume battle" : "Find opponent"}</Link>
        </Button>
      </div>
    </section>
  );
}
