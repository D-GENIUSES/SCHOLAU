import { Timer } from "lucide-react";
import { COPY, formatCountdown } from "@scholau/core";
import { LiveRegion } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

function milestone(remainingMs: number): string | null {
  if (remainingMs <= 0) return "Time is up.";
  if (remainingMs <= 60_000) return "Less than 1 minute left.";
  if (remainingMs <= 5 * 60_000) return "Less than 5 minutes left.";
  return null;
}

/** Display-only countdown derived from the server clock. The server decides which answers count. */
export function AttemptTimer({ remainingMs }: { remainingMs: number }) {
  const low = remainingMs <= 60_000;
  const warn = remainingMs <= 5 * 60_000;
  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          "inline-flex items-center gap-2 self-start rounded-pill border px-3 py-1 font-bold tabular-nums",
          low ? "border-[#f3c4bf] bg-danger-bg text-danger" : warn ? "border-[#f0d9a8] bg-warning-bg text-warning" : "border-line bg-surface-card text-ink",
        )}
      >
        <Timer className="size-4" aria-hidden />
        <span>
          <span className="sr-only">Time remaining: </span>
          {formatCountdown(remainingMs)}
        </span>
      </div>
      <p className="text-sm text-ink-muted">{COPY.learning.timerRule}</p>
      <LiveRegion>{milestone(remainingMs)}</LiveRegion>
    </div>
  );
}
