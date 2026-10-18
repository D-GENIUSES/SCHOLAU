"use client";

import { CheckCircle2, CircleDashed } from "lucide-react";
import type { Battle, BattleParticipant } from "@scholau/api";
import { useReadyBattle } from "@scholau/api/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveRegion } from "@/components/ui/misc";
import { InlineError } from "@/components/ui/states";
import { CountdownBar } from "./countdown";
import { useRefetchWhenDue } from "./hooks";
import { BattleRulesList } from "./rules-card";

export function ReadyPanel({ battle, refetch }: { battle: Battle; refetch: () => unknown }) {
  const ready = useReadyBattle();
  const remaining = useRefetchWhenDue(battle.ready_deadline, refetch);
  const opponent = battle.participants.find((p) => !p.is_me);
  const iAmReady = Boolean(battle.me?.ready);
  const opponentReady = Boolean(opponent?.ready);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{opponent ? `You vs ${opponent.display_name}` : "Opponent found"}</CardTitle>
        <CardDescription>{battle.courses?.map((c) => c.code).join(" + ") ?? battle.course?.code} · {battle.round_count} questions · Reading time, then 5–15 seconds each</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ul className="flex flex-col gap-2" aria-label="Ready status">
          {battle.participants.map((p) => (
            <ReadyRow key={p.seat} participant={p} />
          ))}
        </ul>
        <CountdownBar remainingMs={remaining} totalMs={Math.max(10_000, remaining)} label="Time left to get ready" warnBelowMs={3000} />
        <p className="text-sm text-ink-muted">If both players aren&apos;t ready in time, the battle is cancelled with no XP.</p>
        <BattleRulesList />
        <InlineError error={ready.error} />
        <LiveRegion>
          {iAmReady ? (opponentReady ? "Both players are ready." : "You're ready. Waiting for your opponent.") : ""}
        </LiveRegion>
      </CardContent>
      <CardFooter>
        <Button
          size="lg"
          onClick={() => ready.mutate({ battleId: battle.battle_id })}
          loading={ready.isPending}
          disabled={iAmReady}
          block
        >
          {iAmReady ? (
            <>
              <CheckCircle2 className="size-5" aria-hidden /> You&apos;re ready
            </>
          ) : (
            "I'm ready"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ReadyRow({ participant: p }: { participant: BattleParticipant }) {
  return (
    <li className="flex items-center gap-3 rounded-control border border-line p-3">
      <Avatar name={p.display_name} path={p.avatar_path} size={32} />
      <span className="min-w-0 flex-1 truncate font-semibold">
        {p.display_name}
        {p.is_me ? <span className="font-normal text-ink-muted"> (you)</span> : null}
      </span>
      {p.ready ? (
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
          <CheckCircle2 className="size-4" aria-hidden /> Ready
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted">
          <CircleDashed className="size-4" aria-hidden /> Not ready yet
        </span>
      )}
    </li>
  );
}
