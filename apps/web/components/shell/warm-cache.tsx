"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { qk } from "@scholau/api";
import { useScholauApi } from "@scholau/api/react";

const fresh = 60_000;

/** Prefetch in idle slices so first paint stays responsive. */
export function WarmCache() {
  const api = useScholauApi();
  const qc = useQueryClient();
  useEffect(() => {
    const warmNow = () => {
      void Promise.allSettled([
        qc.prefetchQuery({ queryKey: qk.notifications(), queryFn: () => api.listNotifications(), staleTime: fresh }),
        qc.prefetchQuery({ queryKey: qk.liveBattle(), queryFn: api.getMyLiveBattle, staleTime: 15_000 }),
      ]);
    };
    const warmLater = () => {
      void Promise.allSettled([
        qc.prefetchQuery({ queryKey: qk.catalog(), queryFn: api.getCatalog, staleTime: fresh }),
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
      ]);
    };
    const schedule = (run: () => void, timeout: number) =>
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(run, { timeout })
        : window.setTimeout(run, Math.min(timeout, 400));
    const first = schedule(warmNow, 800);
    const second = schedule(warmLater, 5_000);
    return () => {
      if (typeof first === "number") window.clearTimeout(first);
      else window.cancelIdleCallback(first);
      if (typeof second === "number") window.clearTimeout(second);
      else window.cancelIdleCallback(second);
    };
  }, [api, qc]);
  return null;
}
