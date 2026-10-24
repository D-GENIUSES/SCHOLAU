"use client";

import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import type { Battle } from "@scholau/api";
import { COPY } from "@scholau/core";
import { ReportDialog } from "@/components/report-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/states";
import { useServerCountdown } from "@/lib/hooks";
import { useAfter, useRefetchWhenDue } from "./hooks";
import { QuestionPanel } from "./question-panel";

/**
 * countdown/active rendering. Phases are derived from server timestamps (starts_at, question
 * deadlines, ends_at) for display only; the server decides answer eligibility and the result.
 */
export function PlayPhase({ battle, refetch }: { battle: Battle; refetch: () => unknown }) {
  const toEnd = useServerCountdown(battle.ends_at);
  const toStart = useServerCountdown(battle.starts_at);

  if (battle.ends_at && toEnd <= 0) return <FinalizingPanel battleId={battle.battle_id} refetch={refetch} />;
  if (battle.starts_at && toStart > 0) return <CountdownPanel remainingMs={toStart} />;
  if (battle.current_question) {
    return <QuestionPanel key={battle.current_question.position} battle={battle} question={battle.current_question} refetch={refetch} />;
  }
  if (battle.next_question_at) return <BetweenRounds key={battle.next_question_at} at={battle.next_question_at} refetch={refetch} />;
  return <SyncingPanel refetch={refetch} />;
}

function CountdownPanel({ remainingMs }: { remainingMs: number }) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center sm:py-12">
        <h2 className="text-2xl font-bold">Get ready</h2>
        <p className="text-ink-muted">The first question appears in</p>
        <p className="text-6xl font-extrabold tabular-nums text-brand-primary" aria-hidden>
          {seconds}
        </p>
        <p className="sr-only" role="status" aria-live="polite">
          {seconds > 0 && seconds % 5 === 0 ? `${seconds} seconds until the first question` : ""}
        </p>
        <p className="text-sm text-ink-muted">{COPY.battle.format}</p>
      </CardContent>
    </Card>
  );
}

function BetweenRounds({ at, refetch }: { at: string; refetch: () => unknown }) {
  const remaining = useRefetchWhenDue(at, refetch);
  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <h2 className="text-xl font-bold" role="status">
          {seconds > 0 ? `Next question in ${seconds}s` : "Loading the next question…"}
        </h2>
      </CardContent>
    </Card>
  );
}

function SyncingPanel({ refetch }: { refetch: () => unknown }) {
  useEffect(() => {
    void refetch();
    const id = window.setInterval(() => void refetch(), 1500);
    return () => window.clearInterval(id);
  }, [refetch]);
  return (
    <div className="flex justify-center py-10">
      <Spinner label="Syncing with the battle…" />
    </div>
  );
}

export function FinalizingPanel({ battleId, refetch }: { battleId: string; refetch: () => unknown }) {
  const slow = useAfter(30_000);
  useEffect(() => {
    void refetch();
  }, [refetch]);
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <Spinner label={COPY.battle.finalizing} />
        {slow ? (
          <Alert
            tone="warning"
            role="status"
            className="w-full text-left"
            title="Still finalizing — refresh or contact support"
            action={
              <>
                <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                  <RefreshCw className="size-4" aria-hidden /> Refresh
                </Button>
                <ReportDialog targetType="battle" targetId={battleId} triggerLabel="Contact support" />
              </>
            }
          >
            Your answers are safe. Results usually appear within a few seconds.
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
