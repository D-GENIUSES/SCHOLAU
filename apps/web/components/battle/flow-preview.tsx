"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ScholauApi } from "@scholau/api";
import { ScholauApiProvider } from "@scholau/api/react";
import BattlePage from "@/app/(focus)/battles/[id]/page";
import QueuePage from "@/app/(focus)/battles/queue/page";
import { FocusShell } from "@/components/shell/focus-shell";

/** Development-only browser fixture. Requests are intercepted by the browser test;
 * no production credentials, matches or account progress are used. */
export function BattleFlowPreview() {
  const { id } = useParams<{ id: string }>();
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [api] = useState(() => {
    const request = async (action: string, args?: unknown) => {
      const response = await fetch(`/__battle-ui-fixture/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args ?? {}),
      });
      if (!response.ok) throw new Error("Run this fixture through the Battles browser test.");
      return response.json();
    };
    return {
      supabase: {
        realtime: { setAuth: async () => undefined },
        channel: () => {
          let receive: ((event: unknown) => void) | undefined;
          const listener = (event: Event) => receive?.((event as CustomEvent).detail);
          return {
            on: (_type: string, _filter: unknown, callback: (event: unknown) => void) => { receive = callback; },
            subscribe: (callback: (status: string) => void) => {
              window.addEventListener("battle-preview-signal", listener);
              callback("SUBSCRIBED");
            },
            close: () => window.removeEventListener("battle-preview-signal", listener),
          };
        },
        removeChannel: (channel: { close: () => void }) => channel.close(),
      },
      getBattleState: () => request("state"),
      getMyLiveBattle: () => request("queue"),
      joinQueue: () => request("join"),
      leaveQueue: () => request("leave"),
      getHomeSummary: async () => ({ enrolled_courses: [{ offering_id: "physics", code: "PHY 101", title: "General Physics" }] }),
      submitBattleAnswer: (args: unknown) => request("answer", args),
      sendBattleReaction: (args: unknown) => request("reaction", args),
      readyBattle: () => request("ready"),
      forfeitBattle: () => request("forfeit"),
      getBattleCorrection: (args: unknown) => request("correction", args),
      getMyProfile: async () => ({ xp_total: 120 }),
      getXpProgress: async () => ({ xp_total: 120, badges: [], reviews: [] }),
      getFriends: async () => ({ people: [], username: "preview" }),
    } as unknown as ScholauApi;
  });
  return <QueryClientProvider client={client}><ScholauApiProvider api={api}>
    <FocusShell>{id === "queue" ? <QueuePage /> : <BattlePage />}</FocusShell>
  </ScholauApiProvider></QueryClientProvider>;
}
