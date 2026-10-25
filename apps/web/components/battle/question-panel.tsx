"use client";
import { InlineSkeleton } from "@/components/ui/misc";

import { Clock, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type Battle, type BattleCurrentQuestion, isApiError } from "@scholau/api";
import { normalizeGapAnswer } from "@scholau/core";
import { useSubmitBattleAnswer } from "@scholau/api/react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { LiveRegion } from "@/components/ui/misc";
import { InlineError } from "@/components/ui/states";
import { useServerCountdown } from "@/lib/hooks";
import { BattleAnswerOptions } from "./answer-options";
import { BattleGapAnswer } from "./gap-answer";
import { totalWindowMs } from "./countdown";
import { useRefetchWhenDue } from "./hooks";
import { BattleRoundProgress, BattleTimer } from "./arena";
import "./battle-arena.css";

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
  const readingRemaining = useServerCountdown(question.opened_at);
  const reading = readingRemaining > 0;
  const [selected, setSelected] = useState<string | null>(question.my_option_id);
  const [gapText, setGapText] = useState(question.my_text_answer ?? "");
  const isGap = question.answer_format === "fill_in_gap";
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const ack = submit.data && submit.data.position === question.position ? submit.data : null;
  const lockedOption = ack?.option_id ?? question.my_option_id;
  const lockedGap = ack?.text_answer ?? question.my_text_answer;
  const shown = lockedOption ?? selected;

  let status: AnswerStatus = "idle";
  if (lockedOption || (isGap && lockedGap)) status = "received";
  else if (submit.isPending) status = "sending";
  else if (isApiError(submit.error, "NETWORK")) status = "unsent";
  else if (isApiError(submit.error, "DEADLINE_PASSED")) status = "time_up";
  else if (submit.error) status = "error";
  else if (selected) status = "selected";

  const optionsLocked = reading || remaining <= 0 || status === "received" || status === "sending" || status === "unsent" || status === "time_up";
  const canSubmitGap = isGap && gapText.trim().length > 0;
  const keptEarlier = Boolean(ack?.already_answered && selected && ack.option_id !== selected);

  const send = () => {
    if (isGap) {
      if (!canSubmitGap) return;
      submit.mutate({ battleId: battle.battle_id, position: question.position, textAnswer: normalizeGapAnswer(gapText) });
      return;
    }
    if (!selected) return;
    submit.mutate({ battleId: battle.battle_id, position: question.position, optionId: selected });
  };

  return (
    <div className="battle-question-flow flex min-w-0 flex-col gap-2">
      <BattleRoundProgress count={battle.round_count} position={question.position} answered={battle.my_answered_positions} />
      <Card className="battle-question-card rounded-2xl border-brand-primary/20 shadow-none">
      <CardContent className="flex flex-col gap-3 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 ref={headingRef} tabIndex={-1} className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted focus:outline-none">
              {question.course_code ?? battle.course?.code ?? "Battle question"}
            </h2>
            <p className="mt-1 text-xs text-ink-muted" role="status">{reading ? `Reading time · then ${question.duration_seconds ?? 5}s to answer` : "Answer now · select, then submit"}</p>
          </div>
          <BattleTimer remainingMs={reading ? readingRemaining : remaining} totalMs={reading ? totalWindowMs(question.reading_at, question.opened_at, 3000) : totalWindowMs(question.opened_at, question.deadline, 5000)} reading={reading} />
        </div>

        {isGap ? (
          <BattleGapAnswer question={question} value={gapText} disabled={optionsLocked} onChange={setGapText} />
        ) : (
          <BattleAnswerOptions question={question} selected={shown} disabled={optionsLocked} received={status === "received"} onSelect={setSelected} />
        )}

        <StatusLine status={status} />
        {keptEarlier ? <p className="text-sm text-ink-muted">Your first answer for this question was kept.</p> : null}
        {status === "error" ? <InlineError error={submit.error} /> : null}
        <LiveRegion>{STATUS_ANNOUNCEMENT[status]}</LiveRegion>
      </CardContent>
      {status === "received" || status === "time_up" ? null : (
        <CardFooter className="battle-submit-bar">
          {status === "unsent" ? (
            <Button size="lg" block onClick={submit.retryLast}>
              Retry sending answer
            </Button>
          ) : (
            <Button size="lg" block onClick={send} disabled={reading || remaining <= 0 || (isGap ? !canSubmitGap : !selected)} loading={status === "sending"}>
              {reading ? "Read the question first" : selected || (isGap && canSubmitGap) ? "Submit answer" : "Select an answer"}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
    </div>
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
      return <p className="text-sm font-semibold text-ink-muted">Selected - lock in to send your answer.</p>;
    case "sending":
      return (
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted">
          <InlineSkeleton /> Sending…
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
