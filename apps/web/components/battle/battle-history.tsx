"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { BattleHistoryItem } from "@scholau/api";
import { useBattleHistory } from "@scholau/api/react";
import { formatDate, formatXpDelta } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";
import { OutcomeBadge } from "./outcome";

export function BattleHistory() {
  const history = useBattleHistory();
  const items = history.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section aria-labelledby="battle-history-heading" className="battle-history flex flex-col gap-3">
      <div className="battle-history-heading"><div><h2 id="battle-history-heading" className="text-base font-bold">Battle history</h2><p>Completed matches</p></div></div>
      {history.isPending ? (
        <LoadingState label="Loading battle history…" lines={3} />
      ) : history.isError && items.length === 0 ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No battles yet"
          description="Finished matches will appear here."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.battle_id}>
                <HistoryRow item={item} />
              </li>
            ))}
          </ul>
          {history.isFetchNextPageError ? <InlineError error={history.error} /> : null}
          {history.hasNextPage ? (
            <Button
              variant="outline"
              className="self-center"
              loading={history.isFetchingNextPage}
              onClick={() => void history.fetchNextPage()}
            >
              Load more
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}

function HistoryRow({ item }: { item: BattleHistoryItem }) {
  const scored = item.my_correct !== null && item.opponent_correct !== null;
  const showXp = item.outcome !== "in_progress" && item.outcome !== "cancelled";
  return (
    <Link
      href={`/battles/${item.battle_id}`}
      className="flex items-center gap-3 rounded-card border border-line bg-surface-card p-4 shadow-card hover:border-line-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <OutcomeBadge outcome={item.outcome} />
          <span className="font-semibold">{item.courses?.map((c) => c.code).join(" + ") ?? item.course.code}</span>
          <span className="text-sm text-ink-muted">{formatDate(item.created_at)}</span>
        </div>
        <p className="truncate text-sm text-ink-muted">
          {item.opponent ? <>vs {item.opponent.display_name}</> : "No opponent joined"}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        {scored ? (
          <span className="font-bold tabular-nums">
            <span className="sr-only">Score: you </span>
            {item.my_correct}
            <span aria-hidden>–</span>
            <span className="sr-only">, opponent </span>
            {item.opponent_correct}
          </span>
        ) : null}
        {showXp ? <span className="text-sm font-semibold text-ink-muted">{formatXpDelta(item.xp_awarded)}</span> : null}
      </div>
      <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
    </Link>
  );
}