import { ArrowRight, Flame, Infinity as InfinityIcon, Trophy, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { HomeSummary } from "@scholau/api";
import { COPY, formatStreak, formatXp } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
export function StatsPanel({ summary }: { summary: Pick<HomeSummary, "streak" | "xp_total"> }) {
  return <section aria-label="Your progress" className="home-stats"><div className="home-stat"><span className="stat-symbol"><Trophy className="size-5" aria-hidden /></span><div><strong>{formatXp(summary.xp_total)}</strong><small>Total earned</small></div></div><div className="home-stat"><span className="stat-symbol"><Flame className="size-5" aria-hidden /></span><div><strong>{formatStreak(summary.streak.current)}<span className="hidden sm:inline"> streak</span></strong><small>{summary.streak.active_today ? "Keep it going!" : "Start learning today"}</small></div></div></section>;
}
export function LearningXpCard({ today, cap }: { today: number; cap: number | null }) {
  const reached = cap !== null && today >= cap;
  return <Card className="daily-progress"><CardHeader><CardTitle className="inline-flex items-center gap-2"><Zap className="size-5 text-brand-primary" aria-hidden />Learning XP today</CardTitle></CardHeader><CardContent className="flex flex-col gap-3"><p className="text-sm text-ink-muted">{formatXp(today)}{cap !== null ? ` of ${formatXp(cap)}` : " earned from learning"}</p>{cap !== null ? <Progress value={cap > 0 ? 100 * today / cap : 0} label="Learning XP earned today" tone={reached ? "success" : "brand"} className="h-1.5" /> : null}<p className="text-sm text-ink-muted">{reached ? `${COPY.learning.capReached} ${COPY.learning.capReset}` : "Small steps today. More confidence tomorrow."}</p></CardContent></Card>;
}
export function BattleCard({ live, guest = false }: { live: HomeSummary["live_battle"]; guest?: boolean }) {
  const resumeHref = live?.battle_id ? `/battles/${live.battle_id}` : live?.queue_id ? "/battles/queue" : null;
  return <section className="battle-spotlight" aria-label="Quiz battles"><div className="battle-content"><p className="eyebrow">1V1 QUIZ BATTLES</p><h2>{resumeHref ? "Your battle awaits." : "Ready for a challenge?"}</h2><p className="battle-benefit"><InfinityIcon className="size-4" aria-hidden />Unlimited battles</p><p className="battle-benefit"><Zap className="size-4" aria-hidden />XP for every completed match</p><Button asChild size="sm" className="mt-3 rounded-pill self-start"><Link href={guest ? "/home?view=battles" : resumeHref ?? "/battles"}>{resumeHref ? "Resume battle" : "Find opponent"}<ArrowRight className="size-4" aria-hidden /></Link></Button></div><Image unoptimized src="/illustrations/battle-trophy.webp" alt="" width={512} height={512} sizes="(max-width: 639px) 145px, 220px" className="battle-art" /></section>;
}
