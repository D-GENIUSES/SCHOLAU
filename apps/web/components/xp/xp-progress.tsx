"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { Award, BookOpen, Check, GraduationCap, Layers, Star, Target } from "lucide-react";
import { useStartTopicReview, useXpProgress } from "@scholau/api/react";
import { formatDateTime, formatXpDelta, XP_BADGES, xpProgress } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { ErrorState, InlineError, LoadingState } from "@/components/ui/states";

const badgeArtwork = {
  first_steps: { icon: BookOpen, ribbon: "#344e68" },
  topic_mastered: { icon: Target, ribbon: "#3e6255" },
  perfect_practice: { icon: Star, ribbon: "#854439" },
  exam_ready: { icon: GraduationCap, ribbon: "#344e68" },
  long_term_recall: { icon: Layers, ribbon: "#62536e" },
};

function AchievementMedal({ code, earned }: { code: string; earned: boolean }) {
  const id = useId();
  const artwork = badgeArtwork[code as keyof typeof badgeArtwork] ?? { icon: Award, ribbon: "#344e68" };
  const Icon = artwork.icon;
  return <svg viewBox="0 0 100 116" className="h-[100px] w-[86px] shrink-0" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={earned ? "#f5e8bf" : "#e8e7e3"} /><stop offset=".28" stopColor={earned ? "#d5b46b" : "#c7c7c2"} /><stop offset=".5" stopColor={earned ? "#f6e6af" : "#efeeea"} /><stop offset=".78" stopColor={earned ? "#b48c43" : "#bcbdb9"} /><stop offset="1" stopColor={earned ? "#e5ca89" : "#deded9"} /></linearGradient>
      <linearGradient id={`${id}-face`} x2="0" y2="1"><stop stopColor={earned ? "#f1dfac" : "#e9e8e3"} /><stop offset="1" stopColor={earned ? "#d4b470" : "#d3d3cd"} /></linearGradient>
    </defs>
    <path d="M27 68 20 110 39 102 49 114 53 73M47 73 53 114 63 102 82 110 73 68" fill={earned ? artwork.ribbon : "#a5aaa9"} />
    <path d="m30 79-5 24 8-4 5-24m27 4 5 24-8-4-5-24" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="2" />
    <ellipse cx="50" cy="51" rx="42" ry="43" fill="#192b3c" opacity=".08" />
    <circle cx="50" cy="48" r="42" fill={`url(#${id}-metal)`} stroke={earned ? "#ae8947" : "#b5b7b1"} />
    <circle cx="50" cy="48" r="38" fill="none" stroke={earned ? "#fff5d7" : "#f6f5f1"} strokeWidth="1.2" />
    <circle cx="50" cy="48" r="34" fill={`url(#${id}-face)`} stroke={earned ? "#b08a45" : "#b8b9b2"} strokeWidth=".8" />
    <g fill="none" stroke={earned ? "#9a7438" : "#979c96"} strokeWidth="1.2" strokeLinecap="round">
      <path d="M43 74C23 68 17 49 27 32M57 74C77 68 83 49 73 32" />
      {[0,1,2,3,4].map(i=><g key={i} transform={`translate(0 ${i*6})`}><path d={`M${25+i*.8} ${36}q-8 -3 -6 -8q7 0 6 8q7 -4 7 -9`} /><path d={`M${75-i*.8} ${36}q8 -3 6 -8q-7 0 -6 8q-7 -4 -7 -9`} /></g>)}
    </g>
    <Icon x="35" y="29" width="30" height="30" color={earned ? "#80602e" : "#858d87"} strokeWidth={1.5} />
    <path d="m50 64 1.1 2.2 2.4.4-1.7 1.7.4 2.4-2.2-1.1-2.2 1.1.4-2.4-1.7-1.7 2.4-.4Z" fill={earned ? "#99733a" : "#969c95"} />
  </svg>;
}

export function AchievementBadges({ badges }: { badges: { code: string }[] }) {
  const entries = Object.entries(XP_BADGES);
  const earnedCodes = new Set(badges.map((badge) => badge.code));
  const earnedCount = entries.filter(([code]) => earnedCodes.has(code)).length;
  return <section aria-label="Achievement badges" className="flex min-w-0 flex-col gap-4">
    <div className="border-b border-line pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div><h3 className="font-semibold tracking-tight">Your badge collection</h3><p className="mt-1 text-xs text-ink-muted">Achievements earned through your studies.</p></div>
        </div>
        <span className="rounded-full border border-line bg-surface-card px-3 py-1.5 text-xs font-semibold text-brand-primary">{earnedCount} of {entries.length} earned</span>
      </div>
      <div className="mt-4"><Progress value={entries.length ? earnedCount / entries.length * 100 : 0} label="Badge collection progress" /></div>
      {earnedCount === 0 ? <p className="mt-2 text-xs leading-relaxed text-ink-muted">Complete a lesson knowledge check to earn your first badge.</p> : null}
    </div>
    <ul className="grid min-w-0 list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
      {entries.map(([code, badge]) => {
        const earned = earnedCodes.has(code);
        return <li key={code} className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-4 ${earned ? "border-[#d8c9a9] bg-[#fcfaf5]" : "border-[#e5e6e2] bg-[#fafaf8]"}`}>
          <AchievementMedal code={code} earned={earned} />
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${earned ? "text-[#52644f]" : "text-ink-muted"}`}>{earned ? <Check className="size-3" aria-hidden="true" /> : null}{earned ? "Earned" : "Not yet earned"}</span>
            <h4 className="mt-1 text-sm font-semibold leading-snug text-ink">{badge.title}</h4>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{badge.description}</p>
          </div>
        </li>;
      })}
    </ul>
  </section>;
}

export function XpLevel({ total }: { total: number }) {
  const p = xpProgress(total);
  return <div className="flex flex-col gap-2">
    <p className="font-semibold">Level {p.level} · {total.toLocaleString()} XP</p>
    <Progress value={100 * p.earned / p.required} label={`Progress to level ${p.level + 1}`} />
    <p className="text-sm text-ink-muted">{p.required - p.earned} XP to level {p.level + 1}</p>
  </div>;
}

export function XpProgressCard({ compact = false }: { compact?: boolean }) {
  const query = useXpProgress();
  const review = useStartTopicReview();
  const router = useRouter();
  if (query.isPending) return <LoadingState label="Loading learning progress…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;
  return <Card><CardHeader><CardTitle>Your learning progress</CardTitle></CardHeader>
    <CardContent className="flex flex-col gap-5">
      <XpLevel total={data.xp_total} />
      {compact ? null : <>
        <AchievementBadges badges={data.badges} />
        <section aria-label="Scheduled topic reviews" className="flex flex-col gap-3">
          <h3 className="font-semibold">Scheduled reviews</h3>
          <p className="text-sm text-ink-muted">Score 80% on a topic check to schedule reviews after 1, 7, and 30 days. Each review earns 10 XP at 80% or higher.</p>
          {data.reviews.map((r) => <div key={`${r.lesson_id}:${r.stage}`} className="flex flex-col gap-1">
            <p>{r.title} · Review {r.stage}</p>
            <p className="text-sm text-ink-muted">{r.completed ? "Completed" : `Due ${formatDateTime(r.due_at)}`}</p>
            {r.available ? <Button size="sm" loading={review.isPending} onClick={() => review.mutate({ lessonId: r.lesson_id, stage: r.stage }, { onSuccess: (a) => router.push(`/attempts/${a.attempt_id}`) })}>Start review</Button> : r.completed ? null : <p className="text-sm text-ink-muted">Available when due, after the previous review, with published questions and an active course enrollment.</p>}
          </div>)}
          <InlineError error={review.error} />
        </section>
        <section aria-label="XP history" className="flex flex-col gap-2">
          <h3 className="font-semibold">Recent XP history</h3>
          {data.history.length === 0 ? <p>No XP awards yet. Complete a knowledge check to begin.</p> : null}
          {data.history.map((h) => <div key={h.id}><p>{formatXpDelta(h.amount)} · {h.activity}</p><p className="text-sm text-ink-muted">{h.reason} · {formatDateTime(h.date)}</p></div>)}
        </section>
      </>}
    </CardContent>
  </Card>;
}
