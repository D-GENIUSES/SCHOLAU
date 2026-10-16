"use client";

import { useRouter } from "next/navigation";
import { useStartTopicReview, useXpProgress } from "@scholau/api/react";
import { formatDateTime, formatXpDelta, XP_BADGES, xpProgress } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { ErrorState, InlineError, LoadingState } from "@/components/ui/states";

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
        <section aria-label="Achievement badges" className="flex flex-col gap-2">
          <h3 className="font-semibold">Badges</h3>
          {Object.entries(XP_BADGES).map(([code, badge]) => {
            const earned = data.badges.some((b) => b.code === code);
            return <div key={code}><p>{earned ? "✓ " : ""}{badge.title} · {earned ? "Earned" : "To earn"}</p><p className="text-sm text-ink-muted">{badge.description}</p></div>;
          })}
        </section>
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
