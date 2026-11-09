"use client";

import Link from "next/link";
import { Swords } from "lucide-react";
import type { ReactNode } from "react";
import type { QueueEntry } from "@scholau/api";
import { COPY, formatCountdown } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useServerCountdown, useServerElapsed } from "@/lib/hooks";
import { CountdownBar, totalWindowMs } from "./countdown";

/** Waiting room for one queue entry; switches to the "no opponent" state when the server window ends. */
export function QueueWaiting({
  queue,
  courseLabel,
  onCancel,
  cancelling,
  noOpponent,
}: {
  queue: QueueEntry;
  courseLabel: string | null;
  onCancel: () => void;
  cancelling: boolean;
  noOpponent: ReactNode;
}) {
  const remaining = useServerCountdown(queue.expires_at);
  const elapsed = useServerElapsed(queue.queued_at);
  if (remaining <= 0) return <>{noOpponent}</>;
  return (
    <Card className="rounded-2xl border-brand-primary/20 shadow-none">
      <CardHeader className="items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-tint text-brand-primary"><Swords className="size-7" aria-hidden /></span>
        <CardTitle as="h2">Looking for an opponent</CardTitle>
        <CardDescription>
          {courseLabel ? `${courseLabel} · ` : null}We&apos;ll match you with a classmate in the same course.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="rounded-xl bg-surface-tint p-4 text-center text-sm text-ink-muted">
          Searching for <span className="block text-3xl font-bold tabular-nums text-brand-primary">{formatCountdown(elapsed)}</span>
        </p>
        <CountdownBar
          remainingMs={remaining}
          totalMs={totalWindowMs(queue.queued_at, queue.expires_at, 60_000)}
          label="Search time left"
          warnBelowMs={10_000}
        />
      </CardContent>
      <CardFooter>
        <Button className="min-h-11" block variant="outline" onClick={onCancel} loading={cancelling}>
          Cancel search
        </Button>
      </CardFooter>
    </Card>
  );
}

export function NoOpponent({ onRetry, retrying, canRetry }: { onRetry: () => void; retrying: boolean; canRetry: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{COPY.battle.noOpponent}</CardTitle>
        <CardDescription>Nobody else was searching in this course. You can try again or keep studying.</CardDescription>
      </CardHeader>
      <CardFooter className="pt-2 sm:pt-2">
        {canRetry ? (
          <Button onClick={onRetry} loading={retrying}>
            Try again
          </Button>
        ) : (
          <Button asChild>
            <Link href="/battles">Pick a course</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/home">Continue learning</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
