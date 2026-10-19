import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

/**
 * Focused shell for battles and assessments: no navigation, so leaving goes through the page's own
 * "Leave" control which explains save/forfeit consequences.
 */
export function FocusShell({ children }: { children: ReactNode }) {
  return (
    <div className="focus-shell flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface-card">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <Logo className="h-8" />
          <div id="focus-header-slot" className="ml-auto flex items-center gap-2" />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="pb-safe flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
