import type { AnySupabaseClient } from "./client";

export type ChannelStatus = "connecting" | "connected" | "reconnecting" | "closed";

/** Topic names authorized by authz.can_access_topic (private channels). */
export const topics = {
  battle: (battleId: string) => `battle:${battleId}`,
  user: (userId: string) => `user:${userId}`,
} as const;

export interface SignalSubscription {
  unsubscribe: () => void;
}

/**
 * Subscribes to a private, server-originated broadcast topic. Payloads are treated as *signals only*:
 * callers must refetch authoritative state (e.g. get_battle_state_v1) instead of trusting them.
 */
export function subscribeToSignals(
  supabase: AnySupabaseClient,
  topic: string,
  handlers: { onSignal: (event: string) => void; onStatus?: (status: ChannelStatus) => void },
): SignalSubscription {
  let closed = false;
  handlers.onStatus?.("connecting");

  const channel = supabase.channel(topic, { config: { private: true } });
  channel.on("broadcast", { event: "*" }, (msg: { event?: string }) => {
    if (!closed) handlers.onSignal(msg.event ?? "state");
  });

  void (async () => {
    try {
      // Private channels authorize with the current access token.
      await supabase.realtime.setAuth();
    } catch {
      // Proceed; subscription status will report failure.
    }
    if (closed) return;
    channel.subscribe((status) => {
      if (closed) return;
      if (status === "SUBSCRIBED") {
        handlers.onStatus?.("connected");
        // Resync after (re)connect: anything broadcast while disconnected is fetched authoritatively.
        handlers.onSignal("resync");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        handlers.onStatus?.("reconnecting");
      } else if (status === "CLOSED") {
        handlers.onStatus?.("closed");
      }
    });
  })();

  return {
    unsubscribe: () => {
      closed = true;
      void supabase.removeChannel(channel);
    },
  };
}
