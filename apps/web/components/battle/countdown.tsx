"use client";

import { Timer } from "lucide-react";
import { formatCountdown } from "@scholau/core";
import { Progress } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

/** Display-only server-derived countdown with a progress bar. */
export function CountdownBar({
  remainingMs,
  totalMs,
  label,
  className,
  warnBelowMs = 5000,
}: {
  remainingMs: number;
  totalMs: number;
  label: string;
  className?: string;
  warnBelowMs?: number;
}) {
  const pct = totalMs > 0 ? (remainingMs / totalMs) * 100 : 0;
  const low = remainingMs <= warnBelowMs;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-ink-muted">{label}</span>
        <span className={cn("inline-flex items-center gap-1 font-bold tabular-nums", low ? "text-warning" : "text-ink")}>
          <Timer className="size-4" aria-hidden />
          {formatCountdown(remainingMs)}
          {low ? <span className="sr-only"> (almost out of time)</span> : null}
        </span>
      </div>
      <Progress value={pct} label={label} tone={low ? "warning" : "brand"} />
    </div>
  );
}

export function totalWindowMs(start: string | null | undefined, end: string | null | undefined, fallbackMs: number): number {
  if (!start || !end) return fallbackMs;
  const d = Date.parse(end) - Date.parse(start);
  return Number.isFinite(d) && d > 0 ? d : fallbackMs;
}
