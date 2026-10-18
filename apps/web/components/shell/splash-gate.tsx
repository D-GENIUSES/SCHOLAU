import type { ReactNode } from "react";

/** Keep existing shell callers compatible while showing content immediately, including SSR. */
export function SplashGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
