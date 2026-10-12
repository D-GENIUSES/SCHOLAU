"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { serverClock } from "@scholau/core";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Remaining milliseconds until `deadline`, derived from the server clock offset. Display only:
 * the server decides whether something arrived in time.
 */
export function useServerCountdown(deadline: string | null | undefined, intervalMs = 250): number {
  useTicker(Boolean(deadline), intervalMs);
  return deadline ? Math.max(0, serverClock.remaining(deadline)) : 0;
}

/** Elapsed ms since `start` by server time. */
export function useServerElapsed(start: string | null | undefined, intervalMs = 1000): number {
  useTicker(Boolean(start), intervalMs);
  return start ? Math.max(0, serverClock.now() - Date.parse(start)) : 0;
}

function useTicker(active: boolean, intervalMs: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Warn before unloading the page while `active` (browser-native prompt). */
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}

/** Returns true once, the first time `value` becomes true. */
export function useOnceTrue(value: boolean, fn: () => void) {
  const done = useRef(false);
  useEffect(() => {
    if (value && !done.current) {
      done.current = true;
      fn();
    }
  }, [value, fn]);
}
