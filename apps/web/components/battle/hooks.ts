"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useServerCountdown } from "@/lib/hooks";

const noopSubscribe = () => () => {};

/** Browser origin for share links; empty during SSR. */
export function useOrigin(): string {
  return useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
}

export function useCanShare(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

/**
 * Question openings and deadlines are scheduled server timestamps without broadcasts, so refetch the
 * authoritative state once a displayed deadline is reached (then every second until it changes).
 */
export function useRefetchWhenDue(deadline: string | null | undefined, refetch: () => unknown, everyMs = 1000): number {
  const remaining = useServerCountdown(deadline);
  const due = Boolean(deadline) && remaining <= 0;
  useEffect(() => {
    if (!due) return;
    void refetch();
    const id = window.setInterval(() => void refetch(), everyMs);
    return () => window.clearInterval(id);
  }, [due, refetch, everyMs]);
  return remaining;
}

/** True once `ms` have passed since mount. */
export function useAfter(ms: number): boolean {
  const [passed, setPassed] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setPassed(true), ms);
    return () => window.clearTimeout(id);
  }, [ms]);
  return passed;
}
