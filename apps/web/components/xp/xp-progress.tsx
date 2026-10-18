"use client";

import { useRouter } from "next/navigation";
import { Award, BookOpenCheck, Check, CheckCheck, GraduationCap, LockKeyhole, Sparkles, Target, Trophy } from "lucide-react";
import { useStartTopicReview, useXpProgress } from "@scholau/api/react";
import { formatDateTime, formatXpDelta, XP_BADGES, xpProgress } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { ErrorState, InlineError, LoadingState } from "@/components/ui/states";

const badgeArtwork = {
  first_steps: { icon: BookOpenCheck, color: "text-blue-700", background: "from-blue-50 to-sky-100", ring: "ring-blue-200/70" },
  topic_mastered: { icon: Target, color: "text-emerald-700", background: "from-emerald-50 to-teal-100", ring: "ring-emerald-200/70" },
  perfect_practice: { icon: Sparkles, color: "text-amber-700", background: "from-amber-50 to-yellow-100", ring: "ring-amber-200/70" },
  exam_ready: { icon: GraduationCap, color: "text-violet-700", background: "from-violet-50 to-indigo-100", ring: "ring-violet-200/70" },
  long_term_recall: { icon: CheckCheck, color: "text-rose-700", background: "from-rose-50 to-pink-100", ring: "ring-rose-200/70" },
};

export function AchievementBadges({ badges }: { badges: { code: string }[] }) {
  const entries = Object.entries(XP_BADGES);
  const earnedCodes = new Set(badges.map((badge) => badge.code));
  const earnedCount = entries.filter(([code]) => earnedCodes.has(code)).length;
  return <section aria-label="Achievement badges" className="flex min-w-0 flex-col gap-4">
    <div className="rounded-2xl border border-line bg-gradient-to-br from-surface-tint to-surface-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700"><Trophy className="size-5" aria-hidden="true" /></span>
          <div><h3 className="font-semibold tracking-tight">Your badge collection</h3><p className="mt-0.5 text-xs text-ink-muted">Small steps. Lasting achievements.</p></div>
        </div>
        <span className="rounded-full border border-line bg-surface-card px-3 py-1.5 text-xs font-semibold text-brand-primary">{earnedCount} of {entries.length} earned</span>
      </div>
      <div className="mt-4"><Progress value={entries.length ? earnedCount / entries.length * 100 : 0} label="Badge collection progress" /></div>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">{earnedCount === entries.length ? "Collection complete. Keep building on what you know." : earnedCount === 0 ? "Your first achievement starts with a lesson knowledge check." : "Every milestone reflects the effort you put into learning."}</p>
    </div>
    <ul className="grid min-w-0 list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
      {entries.map(([code, badge]) => {
        const earned = earnedCodes.has(code);
        const artwork = badgeArtwork[code as keyof typeof badgeArtwork] ?? { icon: Award, color: "text-blue-700", background: "from-blue-50 to-sky-100", ring: "ring-blue-200/70" };
        const Icon = artwork.icon;
        return <li key={code} className={`group relative flex min-w-0 items-start gap-4 overflow-hidden rounded-2xl border p-4 motion-safe:transition-[box-shadow,transform] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 ${earned ? "border-[#b8e0cc] bg-gradient-to-br from-white to-emerald-50/50 shadow-sm hover:shadow-md" : "border-line bg-surface-card hover:shadow-sm"}`}>
          <span className={`relative mt-1 flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ring-inset ${artwork.background} ${artwork.color} ${artwork.ring}`}>
            <Icon className="size-7" strokeWidth={1.6} aria-hidden="true" />
            <span className={`absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-surface-card ${earned ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-500"}`}>{earned ? <Check className="size-3" strokeWidth={3} aria-hidden="true" /> : <LockKeyhole className="size-2.5" aria-hidden="true" />}</span>
          </span>
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${earned ? "text-emerald-700" : "text-ink-muted"}`}>{earned ? "Earned" : "To unlock"}</span>
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
