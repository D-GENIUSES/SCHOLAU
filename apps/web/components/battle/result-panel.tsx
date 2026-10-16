"use client";
import { XpProgressCard } from "@/components/xp/xp-progress";

import { Ban, CheckCircle2, Equal, MinusCircle, ShieldOff, Trophy, XCircle } from "lucide-react";
import Link from "next/link";
import type { Battle, BattleRound } from "@scholau/api";
import { useProfile } from "@scholau/api/react";
import { formatXp, formatXpDelta } from "@scholau/core";
import { ReportDialog } from "@/components/report-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/misc";
import { cancelReasonCopy } from "./outcome";

const HEADLINE = {
  win: { text: "You won!", icon: Trophy, className: "text-success" },
  loss: { text: "You lost this one", icon: XCircle, className: "text-danger" },
  draw: { text: "It's a draw", icon: Equal, className: "text-brand-primary" },
} as const;

/** finished / voided result. Never shows answer keys or the opponent's choices. */
export function ResultPanel({ battle }: { battle: Battle }) {
  const profile = useProfile();
  const me = battle.participants.find((p) => p.is_me);
  const opponent = battle.participants.find((p) => !p.is_me);
  const voided = battle.state === "voided";
  const result = battle.outcome && battle.outcome.result !== "cancelled" ? battle.outcome.result : null;
  const headline = voided ? { text: "Result voided", icon: ShieldOff, className: "text-warning" } : result ? HEADLINE[result] : null;
  const Icon = headline?.icon;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="items-center text-center">
          {Icon && headline ? <Icon className={`size-10 ${headline.className}`} aria-hidden /> : null}
          <CardTitle as="h2" className="text-2xl">
            {headline?.text ?? "Battle complete"}
          </CardTitle>
          {battle.course ? <p className="text-ink-muted">{battle.course.code} — {battle.course.title}</p> : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
            <Stat label="XP earned" value={formatXpDelta(battle.outcome?.xp_awarded ?? 0)} icon={<Trophy className="size-5" />} />
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

      <XpProgressCard compact />
      {battle.outcome?.xp_awarded === 0 ? <p className="text-sm text-ink-muted">No XP earned: battle limits may have been reached, or no answers were correct. Your first 10 completed matches daily and first 2 per opponent qualify.</p> : null}
      {battle.rounds && battle.rounds.length > 0 ? (
        <section aria-labelledby="rounds-heading" className="flex flex-col gap-3">
          <h2 id="rounds-heading" className="text-xl font-bold">
            Round by round
          </h2>
          <ol className="flex flex-col gap-2">
            {battle.rounds.map((r) => (
              <RoundRow key={r.position} round={r} />
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

function RoundRow({ round }: { round: BattleRound }) {
  const mine = round.my_option_id === null ? "none" : round.my_is_correct ? "correct" : "incorrect";
  return (
    <li className="flex flex-col gap-2 rounded-card border border-line bg-surface-card p-4">
      <p className="text-sm font-semibold text-ink-muted">Question {round.position}</p>
      <p>{round.prompt}</p>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          You: <Mark kind={mine} />
        </span>
        <span>
          Opponent: <Mark kind={round.opponent_is_correct ? "correct" : "incorrect"} />
        </span>
      </div>
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
        <Ban className="size-10 text-ink-muted" aria-hidden />
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
