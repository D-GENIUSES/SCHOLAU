"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { qk } from "@scholau/api";
import { useScholauApi } from "@scholau/api/react";

const fresh = 60_000;

/** Load the main screens while the browser is idle so the first tap can render from cache. */
export function WarmCache() {
  const api = useScholauApi();
  const qc = useQueryClient();
  useEffect(() => {
    const warm = () => {
      const jobs = [
        qc.prefetchQuery({ queryKey: qk.catalog(), queryFn: api.getCatalog, staleTime: fresh }),
        qc.prefetchQuery({ queryKey: qk.liveBattle(), queryFn: api.getMyLiveBattle, staleTime: 15_000 }),
        qc.prefetchQuery({ queryKey: qk.notifications(), queryFn: () => api.listNotifications(), staleTime: fresh }),
        qc.prefetchQuery({ queryKey: ["scholau", "xp"], queryFn: api.getXpProgress, staleTime: 30_000 }),
        qc.prefetchQuery({ queryKey: ["scholau", "social", "invitations"], queryFn: api.getBattleInvitations, staleTime: fresh }),
        qc.prefetchQuery({ queryKey: ["scholau", "social", "setup", null], queryFn: () => api.getBattleSetup(null), staleTime: fresh }),
        qc.prefetchQuery({ queryKey: ["scholau", "social", "friends"], queryFn: api.getFriends, staleTime: fresh }),
        qc.prefetchInfiniteQuery({
          queryKey: qk.leaderboard("global"),
          queryFn: ({ pageParam }) => api.getLeaderboard({ scope: "global", cursor: pageParam, limit: 20 }),
          initialPageParam: null as string | null,
          staleTime: fresh,
        }),
        qc.prefetchInfiniteQuery({
          queryKey: qk.leaderboard("faculty"),
          queryFn: ({ pageParam }) => api.getLeaderboard({ scope: "faculty", cursor: pageParam, limit: 20 }),
          initialPageParam: null as string | null,
          staleTime: fresh,
        }),
        qc.prefetchInfiniteQuery({
          queryKey: qk.battles(),
          queryFn: ({ pageParam }) => api.getMyBattles({ before: pageParam, limit: 20 }),
          initialPageParam: null as string | null,
          staleTime: fresh,
        }),
      ];
      void Promise.allSettled(jobs);
    };
    const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(warm, { timeout: 1200 }) : undefined;
    const timer = idle == null ? window.setTimeout(warm, 250) : undefined;
    return () => {
      if (idle != null) window.cancelIdleCallback(idle);
      if (timer != null) window.clearTimeout(timer);
    };
  }, [api, qc]);
  return null;
}
