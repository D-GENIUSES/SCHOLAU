"use client";

import { Clock, Loader2, Lock, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type Battle, type BattleCurrentQuestion, isApiError } from "@scholau/api";
import { useSubmitBattleAnswer } from "@scholau/api/react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LiveRegion } from "@/components/ui/misc";
import { InlineError } from "@/components/ui/states";
import { useServerCountdown } from "@/lib/hooks";
import { BattleAnswerOptions } from "./answer-options";
import { battleCourseLine, LiveBattleBoard } from "./battle-chrome";
import { totalWindowMs } from "./countdown";
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
  const readingRemaining = useServerCountdown(question.opened_at);
  const reading = readingRemaining > 0;
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

  const optionsLocked = reading || remaining <= 0 || status === "received" || status === "sending" || status === "unsent" || status === "time_up";
  const keptEarlier = Boolean(ack?.already_answered && selected && ack.option_id !== selected);
  const course = battleCourseLine(battle, question.course_code);
  const promptId = `battle-prompt-${question.position}`;
  const answerTotal = totalWindowMs(question.opened_at, question.deadline, (question.duration_seconds ?? 5) * 1000);
  const readingTotal = totalWindowMs(question.reading_at, question.opened_at, 3000);
  const showSubmit = status !== "received" && status !== "time_up";

  const send = () => {
    if (!selected) return;
    submit.mutate({ battleId: battle.battle_id, position: question.position, optionId: selected });
  };

  return (
    <div className="flex flex-col">
      <LiveBattleBoard
        participants={battle.participants}
        roundCount={battle.round_count}
        position={question.position}
        answered={battle.my_answered_positions}
        courseCode={course?.code ?? null}
        courseTitle={course?.title ?? null}
        prompt={question.prompt}
        promptId={promptId}
        headingRef={headingRef}
        remainingMs={reading ? readingRemaining : remaining}
        totalMs={reading ? readingTotal : answerTotal}
        footer={showSubmit ? (
          <div className="flex flex-col gap-3">
            {status === "unsent" ? (
              <Button size="lg" block className="min-h-[52px] bg-[#0875e4] text-[15px] hover:bg-[#0066d6]" onClick={submit.retryLast}>
                Retry sending answer
              </Button>
            ) : (
              <Button
                size="lg"
                block
                className="min-h-[52px] bg-[#0875e4] text-[15px] hover:bg-[#0066d6]"
                onClick={send}
                disabled={reading || !selected || remaining <= 0}
                loading={status === "sending"}
              >
                <Lock className="size-4" aria-hidden />
                Lock in answer
              </Button>
            )}
            {status === "unsent" ? null : (
              <p className="text-center text-[13px] text-[#8093a7]">
                {reading
                  ? `Read the question and all four options. You will then have ${question.duration_seconds ?? 5} seconds to answer.`
                  : "Choose one answer before time runs out."}
              </p>
            )}
          </div>
        ) : null}
      >
        <BattleAnswerOptions
          question={question}
          selected={shown}
          disabled={optionsLocked}
          received={status === "received"}
          onSelect={setSelected}
          labelledBy={promptId}
        />
        <StatusLine status={status} />
        {keptEarlier ? <p className="text-sm text-ink-muted">Your first answer for this question was kept.</p> : null}
        {status === "error" ? <InlineError error={submit.error} /> : null}
      </LiveBattleBoard>
      <LiveRegion>{STATUS_ANNOUNCEMENT[status]}</LiveRegion>
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
