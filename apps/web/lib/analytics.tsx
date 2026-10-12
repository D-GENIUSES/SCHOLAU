"use client";

import { createContext, type ReactNode, useContext } from "react";
import { type AnalyticsAdapter, noopAnalytics } from "@scholau/core";

/**
 * Analytics adapter context. Defaults to a no-op; swap in a PostHog (or equivalent) adapter that
 * receives only opaque user ids and minimal properties. Session replay stays disabled.
 */
const AnalyticsContext = createContext<AnalyticsAdapter>(noopAnalytics);

export function AnalyticsProvider({ adapter = noopAnalytics, children }: { adapter?: AnalyticsAdapter; children: ReactNode }) {
  return <AnalyticsContext.Provider value={adapter}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): AnalyticsAdapter {
  return useContext(AnalyticsContext);
}
