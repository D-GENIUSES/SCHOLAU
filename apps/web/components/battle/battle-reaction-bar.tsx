"use client";

import { useEffect, useState } from "react";
import { subscribeToSignals, topics } from "@scholau/api";
import { useScholauApi, useSendBattleReaction } from "@scholau/api/react";
import type { Battle } from "@scholau/api";
import { Button } from "@/components/ui/button";

const REACTIONS = [
  { id: "laugh" as const, emoji: "😂", label: "Laugh" },
  { id: "angry" as const, emoji: "😠", label: "Taunt" },
  { id: "handshake" as const, emoji: "🤝", label: "Handshake" },
];

export type BattleReactionEvent = {
  userId: string;
  reaction: "laugh" | "angry" | "handshake";
};

export function useBattleReactionFeed(battleId: string | undefined, myUserId: string | undefined) {
  const api = useScholauApi();
  const [event, setEvent] = useState<BattleReactionEvent | null>(null);

  useEffect(() => {
    if (!battleId) return;
    const sub = subscribeToSignals(api.supabase, topics.battle(battleId), {
      onSignal: () => undefined,
      onPayload: (name, payload) => {
        if (name !== "reaction") return;
        const userId = String(payload.user_id ?? "");
        const reaction = payload.reaction;
        if (userId && userId !== myUserId && (reaction === "laugh" || reaction === "angry" || reaction === "handshake")) {
          setEvent({ userId, reaction });
        }
      },
    });
    return () => sub.unsubscribe();
  }, [api, battleId, myUserId]);

  return event;
}

export function BattleReactionBar({ battle }: { battle: Battle }) {
  const send = useSendBattleReaction();
  const me = battle.participants.find((p) => p.is_me);
  const opponent = battle.participants.find((p) => !p.is_me);
  const incoming = useBattleReactionFeed(battle.battle_id, me?.user_id);
  const [bubble, setBubble] = useState<BattleReactionEvent | null>(null);

  useEffect(() => {
    if (!incoming) return;
    setBubble(incoming);
    const timer = window.setTimeout(() => setBubble(null), 2600);
    return () => window.clearTimeout(timer);
  }, [incoming]);

  if (!me || !opponent) return null;

  return (
    <div className="relative flex flex-col gap-2">
      {bubble ? (
        <p className="sr-only" role="status">
          Opponent sent a {bubble.reaction === "handshake" ? "handshake" : bubble.reaction === "laugh" ? "laugh" : "taunt"} reaction
        </p>
      ) : null}
      {bubble ? (
        <div className="pointer-events-none absolute -top-2 right-4 z-10 animate-bounce text-3xl" aria-hidden>
          {REACTIONS.find((r) => r.id === bubble.reaction)?.emoji}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-surface-page px-3 py-2">
        <span className="text-xs font-semibold text-ink-muted">Send reaction</span>
        {REACTIONS.map((r) => (
          <Button
            key={r.id}
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-9 px-2 text-lg"
            disabled={send.isPending}
            aria-label={r.label}
            onClick={() => send.mutate({ battleId: battle.battle_id, reaction: r.id })}
          >
            <span aria-hidden>{r.emoji}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
