"use client";
import { XpProgressCard } from "@/components/xp/xp-progress";

import { BookOpen, CheckCircle2, ChevronUp, MinusCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Battle, BattleRound } from "@scholau/api";
import { useProfile, useScholauApi } from "@scholau/api/react";
import { formatXp, formatXpDelta } from "@scholau/core";
import { ReportDialog } from "@/components/report-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/misc";
import { BattleOpponentFriend } from "./opponent-friend";
import { cancelReasonCopy } from "./outcome";

const HEADLINE = {
  win: { text: "You won" },
  loss: { text: "You lost" },
  draw: { text: "Draw" },
} as const;

/** Finished / voided results; corrections reveal only the viewer's own answer. */
export function ResultPanel({ battle }: { battle: Battle }) {
  const profile = useProfile();
  const me = battle.participants.find((p) => p.is_me);
  const opponent = battle.participants.find((p) => !p.is_me);
  const voided = battle.state === "voided";
  const result = battle.outcome && battle.outcome.result !== "cancelled" ? battle.outcome.result : null;
  const headline = voided ? { text: "Result voided" } : result ? HEADLINE[result] : null;

  const [missedOnly, setMissedOnly] = useState(false);
  const missedCount = battle.rounds?.filter(round => !round.my_is_correct).length ?? 0;
  const visibleRounds = missedOnly ? battle.rounds?.filter(round => !round.my_is_correct) : battle.rounds;
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="items-center text-center">
          <CardTitle as="h2" className="text-2xl">
            {headline?.text ?? "Battle complete"}
          </CardTitle>
          {battle.courses?.length ? <p className="text-ink-muted">{battle.courses.map((c) => c.code).join(" + ")}</p> : battle.course ? <p className="text-ink-muted">{battle.course.code} — {battle.course.title}</p> : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!voided && battle.result_kind === "forfeit" ? <p className="text-center font-medium text-ink-muted">{me?.forfeited ? "You forfeited. Your opponent wins." : "Your opponent forfeited. You win."}</p> : null}
          {voided ? (
            <Alert tone="warning" title="Voided by an administrator">
              This result was voided by an administrator; XP was reversed.
            </Alert>
          ) : null}
          <div className="grid grid-cols-2 items-center gap-3 text-center" role="group" aria-label="Final score">
            <ScoreBox label="You" value={me?.correct_count} total={battle.round_count} />
            <ScoreBox label={opponent?.display_name ?? "Opponent"} value={opponent?.correct_count} total={battle.round_count} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="XP earned" value={formatXpDelta(battle.outcome?.xp_awarded ?? 0)} />
            <Stat
              label="Your XP balance"
              value={profile.data ? formatXp(profile.data.xp_total) : profile.isError ? "Unavailable" : "Updating…"}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link href={`/battles?offering=${encodeURIComponent(battle.offering_id)}`}>Play again</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/battles">Back to battles</Link>
          </Button>
          <ReportDialog targetType="battle" targetId={battle.battle_id} triggerLabel="Report battle" title="Report this battle" />
        </CardFooter>
      </Card>

      {opponent?.user_id ? <BattleOpponentFriend opponent={opponent} /> : null}

      {battle.courses && battle.courses.length > 1 && battle.rounds ? (
        <section aria-label="Results by course" className="grid gap-3 sm:grid-cols-3">
          {battle.courses.map((course) => {
            const rounds = battle.rounds!.filter((r) => r.course_code === course.code);
            return <div key={course.id} className="rounded-xl border border-line bg-surface-card p-4">
              <p className="font-bold">{course.code}</p>
              <p className="text-sm">You: {rounds.filter((r) => r.my_is_correct).length}/{rounds.length}</p>
              <p className="text-sm text-ink-muted">Opponent: {rounds.filter((r) => r.opponent_is_correct).length}/{rounds.length}</p>
            </div>;
          })}
        </section>
      ) : null}
      <XpProgressCard compact />
      {battle.outcome?.xp_awarded === 0 ? <p className="text-sm text-ink-muted">{battle.result_kind === "forfeit" ? "No XP is awarded for forfeited battles." : "No XP earned: battle limits may have been reached, or no answers were correct. Your first 10 completed matches daily and first 2 per opponent qualify."}</p> : null}
      {battle.rounds && battle.rounds.length > 0 ? (
        <section aria-labelledby="rounds-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="rounds-heading" className="text-xl font-bold">{missedOnly ? "Missed questions" : "Round by round"}</h2>
            {missedCount > 0 ? <Button variant="outline" size="sm" aria-pressed={missedOnly} onClick={() => setMissedOnly(value => !value)}>{missedOnly ? "Show all questions" : `Review missed (${missedCount})`}</Button> : null}
          </div>
          <ol className="flex flex-col gap-2">
            {visibleRounds?.map((r) => (
              <RoundRow key={r.position} round={r} battleId={battle.battle_id} />
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function ScoreBox({ label, value, total }: { label: string; value: number | null | undefined; total: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-control border border-line p-4">
      <span className="truncate text-sm font-semibold text-ink-muted">{label}</span>
      <span className="text-3xl font-extrabold tabular-nums">
        {value ?? "–"}
        <span className="text-base font-semibold text-ink-muted">/{total}</span>
      </span>
      <span className="sr-only">correct answers</span>
    </div>
  );
}

export function RoundRow({ round, battleId }: { round: BattleRound; battleId: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const api = useScholauApi();
  const correction = useQuery({
    queryKey: ["scholau", "battle", "correction", battleId, round.position],
    queryFn: () => api.getBattleCorrection({ battleId, position: round.position }),
    enabled: expanded,
    staleTime: Infinity,
    retry: 1,
  });
  const mine = round.my_is_correct ? "correct" : round.my_option_id !== null || round.my_text_answer ? "incorrect" : "none";
  return (
    <li className="flex flex-col gap-2 rounded-card border border-line bg-surface-card p-4">
      <p className="text-sm font-semibold text-ink-muted">Question {round.position}{round.course_code ? ` · ${round.course_code}` : ""}</p>
      <p>{round.prompt}</p>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          You: <Mark kind={mine} />
        </span>
        <span>
          Opponent: <Mark kind={round.opponent_is_correct ? "correct" : "incorrect"} />
        </span>
      </div>
      <Button type="button" variant="ghost" size="sm" className="self-start px-0 text-brand-primary" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
        {expanded ? <ChevronUp className="size-4" aria-hidden /> : <BookOpen className="size-4" aria-hidden />}
        {expanded ? "Hide answer" : "View answer"}
      </Button>
      {expanded ? <div id={id} className="battle-correction">
        {correction.isPending ? <p role="status" className="text-sm text-ink-muted">Loading answer…</p> : correction.isError ? <div><p role="alert" className="text-sm text-ink-muted">Couldn’t load this answer.</p><Button type="button" variant="link" size="sm" onClick={() => void correction.refetch()}>Try again</Button></div> : <>
          <div><p className="battle-correction-label">Your answer</p><p className="whitespace-pre-wrap break-words text-sm">{correction.data.my_answer ?? "No answer submitted"}</p></div>
          <div><p className="battle-correction-label">Correct answer</p><p className="whitespace-pre-wrap break-words text-sm font-semibold">{correction.data.correct_answer ?? "Answer unavailable"}</p></div>
          {correction.data.steps?.length ? <ol className="list-decimal space-y-1 pl-5 text-sm">{correction.data.steps.map((step, index) => <li key={index} className="whitespace-pre-wrap break-words">{step}</li>)}</ol> : null}
          <div><p className="battle-correction-label">Explanation</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{correction.data.explanation || "An explanation hasn’t been added for this question yet."}</p></div>
        </>}
      </div> : null}
    </li>
  );
}

function Mark({ kind }: { kind: "correct" | "incorrect" | "none" }) {
  if (kind === "correct") {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-success">
        <CheckCircle2 className="size-4" aria-hidden /> Correct
      </span>
    );
  }
  if (kind === "incorrect") {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-danger">
        <XCircle className="size-4" aria-hidden /> Incorrect
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-ink-muted">
      <MinusCircle className="size-4" aria-hidden /> No answer
    </span>
  );
}

export function CancelledPanel({ battle }: { battle: Battle }) {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <CardTitle as="h2" className="text-2xl">
          Battle cancelled
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2 text-center">
        <p>{cancelReasonCopy(battle.cancel_reason)}</p>
        <p className="font-semibold">No XP was awarded.</p>
      </CardContent>
      <CardFooter className="justify-center">
        <Button asChild>
          <Link href={`/battles?offering=${encodeURIComponent(battle.offering_id)}`}>Try again</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/battles">Back to battles</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
