"use client";

import { Clock, Loader2, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type Battle, type BattleCurrentQuestion, isApiError } from "@scholau/api";
import { useSubmitBattleAnswer } from "@scholau/api/react";
import { COPY } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { LiveRegion } from "@/components/ui/misc";
import { InlineError } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { CountdownBar, totalWindowMs } from "./countdown";
import { useRefetchWhenDue } from "./hooks";

type AnswerStatus = "idle" | "selected" | "sending" | "received" | "unsent" | "time_up" | "error";

/** One battle round. Mounted per position (keyed), so local selection resets between questions. */
export function QuestionPanel({
  battle,
  question,
  refetch,
}: {
  battle: Battle;
  question: BattleCurrentQuestion;
  refetch: () => unknown;
}) {
  const submit = useSubmitBattleAnswer();
  const remaining = useRefetchWhenDue(question.deadline, refetch);
  const [selected, setSelected] = useState<string | null>(question.my_option_id);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const ack = submit.data && submit.data.position === question.position ? submit.data : null;
  const lockedOption = ack?.option_id ?? question.my_option_id;
  const shown = lockedOption ?? selected;

  let status: AnswerStatus = "idle";
  if (lockedOption) status = "received";
  else if (submit.isPending) status = "sending";
  else if (isApiError(submit.error, "NETWORK")) status = "unsent";
  else if (isApiError(submit.error, "DEADLINE_PASSED")) status = "time_up";
  else if (submit.error) status = "error";
  else if (selected) status = "selected";

  const optionsLocked = status === "received" || status === "sending" || status === "unsent" || status === "time_up";
  const keptEarlier = Boolean(ack?.already_answered && selected && ack.option_id !== selected);

  const send = () => {
    if (!selected) return;
    submit.mutate({ battleId: battle.battle_id, position: question.position, optionId: selected });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-4 sm:pt-6">
        <div className="flex flex-col gap-3">
          <h2 ref={headingRef} tabIndex={-1} className="text-base font-semibold text-ink-muted focus:outline-none">
            Question {question.position} of {battle.round_count}
          </h2>
          <CountdownBar
            remainingMs={remaining}
            totalMs={totalWindowMs(question.opened_at, question.deadline, battle.seconds_per_round * 1000)}
            label="Time left for this question"
          />
          <p className="text-sm text-ink-muted">{COPY.battle.timerRule}</p>
        </div>

        <fieldset disabled={optionsLocked} className="flex flex-col gap-3">
          <legend className="mb-3 text-lg font-bold text-ink">{question.prompt}</legend>
          {question.options.map((o) => {
            const checked = shown === o.id;
            return (
              <label
                key={o.id}
                className={cn(
                  "flex min-h-12 cursor-pointer items-start gap-3 rounded-control border bg-surface-card p-3 transition-colors",
                  checked ? "border-brand-primary bg-surface-tint" : "border-line hover:border-line-strong",
                  optionsLocked && "cursor-default",
                )}
              >
                <input
                  type="radio"
                  name={`battle-q-${question.position}`}
                  value={o.id}
                  checked={checked}
                  onChange={() => setSelected(o.id)}
                  className="mt-1 size-5 shrink-0 accent-brand-primary"
                />
                <span className="flex-1">{o.body}</span>
                {checked && status === "received" ? <span className="text-sm font-semibold text-success">Your answer</span> : null}
              </label>
            );
          })}
        </fieldset>

        <StatusLine status={status} />
        {keptEarlier ? <p className="text-sm text-ink-muted">Your first answer for this question was kept.</p> : null}
        {status === "error" ? <InlineError error={submit.error} /> : null}
        <LiveRegion>{STATUS_ANNOUNCEMENT[status]}</LiveRegion>
      </CardContent>
      {status === "received" || status === "time_up" ? null : (
        <CardFooter>
          {status === "unsent" ? (
            <Button size="lg" block onClick={submit.retryLast}>
              Retry sending answer
            </Button>
          ) : (
            <Button size="lg" block onClick={send} disabled={!selected} loading={status === "sending"}>
              Submit answer
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

const STATUS_ANNOUNCEMENT: Record<AnswerStatus, string> = {
  idle: "",
  selected: "",
  sending: "Sending answer…",
  received: "Answer received",
  unsent: "Answer not sent yet",
  time_up: "Time's up for this question",
  error: "",
};

function StatusLine({ status }: { status: AnswerStatus }) {
  switch (status) {
    case "selected":
      return <p className="text-sm font-semibold text-ink-muted">Selected — submit to send your answer.</p>;
    case "sending":
      return (
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Sending…
        </p>
      );
    case "received":
      return (
        <Alert tone="success" title="Answer received">
          Wait for the next question.
        </Alert>
      );
    case "unsent":
      return (
        <Alert tone="warning" title="Answer not sent yet">
          <span className="inline-flex items-center gap-1">
            <WifiOff className="size-4" aria-hidden /> We couldn&apos;t reach ScholAu. Your choice is kept — retry before the timer ends.
          </span>
        </Alert>
      );
    case "time_up":
      return (
        <Alert tone="warning" title="Time's up for this question">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" aria-hidden /> This answer arrived after the deadline and won&apos;t count.
          </span>
        </Alert>
      );
    default:
      return null;
  }
}