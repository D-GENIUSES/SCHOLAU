"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { isApiError, qk } from "@scholau/api";
import { useBattleSignals, useBattleState, useForfeitBattle } from "@scholau/api/react";
import { isLiveBattleState } from "@scholau/core";
import { BattleTopBar, LeaveBattleDialog, ReconnectBanner } from "@/components/battle/battle-chrome";
import { useAfter } from "@/components/battle/hooks";
import { IntegrityGuard } from "@/components/battle/integrity-guard";
import { PlayPhase } from "@/components/battle/play-phase";
import { ReadyPanel } from "@/components/battle/ready-panel";
import { CancelledPanel, ResultPanel } from "@/components/battle/result-panel";
import { WaitingPanel } from "@/components/battle/waiting-panel";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAnalytics } from "@/lib/analytics";
import { useOnline } from "@/lib/hooks";

export default function BattlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const analytics = useAnalytics();
  const status = useBattleSignals(id);
  const q = useBattleState(id, status);
  const online = useOnline();
  const forfeit = useForfeitBattle();
  const graceOver = useAfter(3000);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const seen = useRef({ live: false, activated: false, completed: false });

  const battle = q.data;
  const live = battle ? isLiveBattleState(battle.state) : false;
  const { refetch: rawRefetch } = q;
  const refetch = useCallback(() => rawRefetch(), [rawRefetch]);

  const state = battle?.state;
  const result = battle?.outcome?.result;
  useEffect(() => {
    if (!state) return;
    if (isLiveBattleState(state)) seen.current.live = true;
    if (state === "active" && !seen.current.activated) {
      seen.current.activated = true;
      analytics.track({ name: "battle_activated", battle_id: id });
    }
    if (state === "finished" && seen.current.live && !seen.current.completed) {
      seen.current.completed = true;
      analytics.track({ name: "battle_completed", battle_id: id, outcome: result ?? "unknown" });
    }
    if (!isLiveBattleState(state)) {
      void Promise.all([
        qc.invalidateQueries({ queryKey: qk.profile() }),
        qc.invalidateQueries({ queryKey: qk.battles() }),
        qc.invalidateQueries({ queryKey: qk.liveBattle() }),
        qc.invalidateQueries({ queryKey: qk.home() }),
      ]);
    }
  }, [state, result, id, analytics, qc]);

  const leave = () => {
    forfeit.mutate(
      { battleId: id },
      {
        onSuccess: () => {
          setLeaveOpen(false);
          router.push("/battles");
        },
      },
    );
  };

  const disconnected = !online || status === "reconnecting" || status === "closed" || (status === "connecting" && graceOver);

  let body: ReactNode;
  if (q.isPending) {
    body = <LoadingState label="Loading battle…" />;
  } else if (!battle) {
    const unavailable = isApiError(q.error, "NOT_FOUND") || isApiError(q.error, "FORBIDDEN");
    body = (
      <ErrorState
        error={q.error}
        title={unavailable ? "This battle isn't available" : "We couldn't load this battle"}
        onRetry={unavailable ? undefined : () => void refetch()}
        action={
          <Button asChild variant={unavailable ? "primary" : "outline"}>
            <Link href="/battles">Back to battles</Link>
          </Button>
        }
      />
    );
  } else {
    switch (battle.state) {
      case "waiting":
        body = (
          <WaitingPanel
            battle={battle}
            refetch={refetch}
            onCancel={leave}
            cancelling={forfeit.isPending}
            cancelError={leaveOpen ? null : forfeit.error}
          />
        );
        break;
      case "ready":
        body = <ReadyPanel battle={battle} refetch={refetch} />;
        break;
      case "countdown":
      case "active":
        body = <IntegrityGuard key={id} battleId={id} onForfeit={refetch}><PlayPhase battle={battle} refetch={refetch} /></IntegrityGuard>;
        break;
      case "finished":
      case "voided":
        body = <ResultPanel battle={battle} />;
        break;
      case "cancelled":
        body = <CancelledPanel battle={battle} />;
        break;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">{battle?.course ? `${battle.course.code} battle` : "Battle"}</h1>
      <BattleTopBar battle={battle} live={live} onLeave={() => setLeaveOpen(true)} />
      {live && disconnected ? <ReconnectBanner onRefresh={() => void refetch()} refreshing={q.isFetching} /> : null}
      {body}
      <LeaveBattleDialog
        open={leaveOpen}
        onOpenChange={(o) => {
          setLeaveOpen(o);
          if (!o) forfeit.reset();
        }}
        onConfirm={leave}
        loading={forfeit.isPending}
        error={forfeit.error}
      />
    </div>
  );
}
