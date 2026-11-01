"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { subscribeToSignals, topics } from "@scholau/api";
import { useScholauApi, useSendBattleReaction } from "@scholau/api/react";
import type { Battle } from "@scholau/api";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";
import { cn } from "@/lib/utils";

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

export function BattleReactionBar({ battle, className }: { battle: Battle; className?: string }) {
  const send = useSendBattleReaction();
  const me = battle.participants.find((p) => p.is_me);
  const opponent = battle.participants.find((p) => !p.is_me);
  const opponentId = opponent?.user_id;
  const incoming = useBattleReactionFeed(battle.battle_id, me?.user_id);
  const [trackedIncoming, setTrackedIncoming] = useState<BattleReactionEvent | null>(null);
  const [bubble, setBubble] = useState<BattleReactionEvent | null>(null);
  const [placedStyle, setPlacedStyle] = useState<CSSProperties | undefined>();
  const [sentFlash, setSentFlash] = useState<(typeof REACTIONS)[number]["id"] | null>(null);
  if (incoming && incoming !== trackedIncoming) {
    setTrackedIncoming(incoming);
    setBubble(incoming);
  }
  const bubbleStyle = bubble && opponentId ? placedStyle : undefined;

  useEffect(() => {
    if (!bubble) return;
    const timer = window.setTimeout(() => setBubble(null), 2600);
    return () => window.clearTimeout(timer);
  }, [bubble]);

  useEffect(() => {
    if (!bubble || !opponentId) return;
    const anchorId = `battle-player-${opponentId}`;
    let frame = 0;
    const place = () => {
      frame = window.requestAnimationFrame(() => setPlacedStyle(positionBubble(anchorId)));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [bubble, opponentId]);

  useEffect(() => {
    if (!sentFlash) return;
    const timer = window.setTimeout(() => setSentFlash(null), 1200);
    return () => window.clearTimeout(timer);
  }, [sentFlash]);

  if (!me || !opponent) return null;

  const bubbleEmoji = bubble ? REACTIONS.find((r) => r.id === bubble.reaction)?.emoji : null;

  return (
    <div className={cn("relative flex flex-col gap-1.5", className)}>
      {bubble ? (
        <p className="sr-only" role="status">
          Opponent sent a {bubble.reaction === "handshake" ? "handshake" : bubble.reaction === "laugh" ? "laugh" : "taunt"} reaction
        </p>
      ) : null}
      {bubbleEmoji && bubbleStyle ? (
        <div
          className="battle-reaction-bubble pointer-events-none fixed z-50 animate-bounce text-4xl drop-shadow-md sm:text-5xl"
          aria-hidden
          style={bubbleStyle}
        >
          {bubbleEmoji}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-dashed border-brand-primary/35 bg-surface-page px-3 py-2.5">
        <span className="w-full text-center text-xs font-bold uppercase tracking-wide text-brand-primary sm:w-auto sm:text-left">Taunt</span>
        {REACTIONS.map((r) => (
          <Button
            key={r.id}
            type="button"
            variant={sentFlash === r.id ? "primary" : "outline"}
            size="sm"
            className="min-h-11 min-w-11 px-3 text-2xl leading-none"
            disabled={send.isPending}
            aria-label={r.label}
            onClick={() => {
              setSentFlash(r.id);
              send.mutate({ battleId: battle.battle_id, reaction: r.id });
            }}
          >
            <span aria-hidden>{r.emoji}</span>
          </Button>
        ))}
      </div>
      <InlineError error={send.error} />
    </div>
  );
}

function positionBubble(anchorId: string): CSSProperties {
  const node = document.getElementById(anchorId);
  if (!node) return { top: "20%", right: "12%" };
  const rect = node.getBoundingClientRect();
  return {
    top: `${Math.max(8, rect.top - 8)}px`,
    left: `${rect.left + rect.width / 2}px`,
    transform: "translate(-50%, -100%)",
  };
}
