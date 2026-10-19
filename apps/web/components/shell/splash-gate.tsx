import type { ReactNode } from "react";

/** The shell paints immediately. Data that is still arriving uses the wave skeleton. */
export function SplashGate({ children }: { children: ReactNode }) {
  return children;
}
