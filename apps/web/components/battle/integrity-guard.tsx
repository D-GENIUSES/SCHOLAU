"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { observeAssessmentWindow, type WindowActivity } from "@/lib/assessment-activity";
import { Alert } from "@/components/ui/alert";

type Signal = WindowActivity | "copy_attempt";

/** Browser signals are review evidence, never proof of cheating. */
export function IntegrityGuard({ battleId, onForfeit, children }: { battleId: string; onForfeit: () => unknown; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [warning, setWarning] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [strikes, setStrikes] = useState(0);

  useEffect(() => {
    const storageKey = `battle-integrity-v1:${battleId}`;
    let pending: { id: string; kind: Signal }[] = [];
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(stored)) pending = stored.filter((e) =>
        e && typeof e.id === "string" && ["app_hidden", "focus_lost", "possible_split_screen", "fullscreen_exit", "copy_attempt"].includes(e.kind)
      ).slice(0, 100);
    } catch { /* Storage may be disabled; in-memory retry still works. */ }
    const persist = () => {
      try { if (pending.length) sessionStorage.setItem(storageKey, JSON.stringify(pending)); else sessionStorage.removeItem(storageKey); }
      catch { /* Storage may be disabled. */ }
    };
    const last = new Map<Signal, number>();
    let sending = false;
    let disposed = false;
    const flush = async () => {
      if (sending || !pending.length) return;
      sending = true;
      try {
        while (pending.length) {
          const event = pending[0]!;
          const { data, error } = await getBrowserSupabase().rpc("report_battle_integrity_v1", {
            p_battle_id: battleId, p_event_id: event.id, p_kind: event.kind,
          });
          if (error) { if (!disposed) setUnsaved(true); break; }
          pending.shift();
          persist();
          if (!disposed) {
            setUnsaved(false);
            setStrikes(data.strikes);
            if (data.forfeited) void onForfeit();
          }
        }
      } catch { if (!disposed) setUnsaved(true); }
      finally { sending = false; }
    };
    const flag = (kind: Signal) => {
      const now = Date.now();
      if (now - (last.get(kind) ?? 0) < 3000) return;
      last.set(kind, now);
      setWarning(true);
      if (pending.length < 100) pending.push({ id: crypto.randomUUID(), kind });
      persist();
      void flush();
    };
    const stopObserving = observeAssessmentWindow(flag, () => void flush());
    const protect = (event: Event) => {
      event.preventDefault();
      if (event.type === "copy" || event.type === "cut") flag("copy_attempt");
    };
    const element = root.current;
    window.addEventListener("online", flush);
    for (const name of ["copy", "cut", "contextmenu", "dragstart", "selectstart"]) element?.addEventListener(name, protect);
    const retry = setInterval(() => void flush(), 5000);
    void (async () => {
      try {
        const client = getBrowserSupabase();
        const { data: { user } } = await client.auth.getUser();
        if (!user || disposed) return;
        const { count, error } = await client.from("battle_integrity_events").select("event_id", { count: "exact", head: true }).eq("battle_id", battleId).eq("user_id", user.id);
        if (!disposed && !error && count !== null) {
          setStrikes((previous) => Math.max(previous, count));
          if (count > 0) setWarning(true);
          if (count >= 3) void onForfeit();
        }
      } catch { /* Event delivery exposes failures and retries independently. */ }
    })();
    void flush();
    return () => {
      disposed = true;
      stopObserving();
      clearInterval(retry);
      window.removeEventListener("online", flush);
      for (const name of ["copy", "cut", "contextmenu", "dragstart", "selectstart"]) element?.removeEventListener(name, protect);
      void flush();
    };
  }, [battleId, onForfeit]);

  return <div ref={root} className="flex select-none flex-col gap-2" style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}>
    <details className="text-xs text-ink-muted"><summary className="w-fit cursor-pointer font-medium">Fair play rules</summary><p className="mt-2">Fair play: stay in this app, use a full window, and do not share your screen. Copying battle text is disabled. Leaving, losing focus, or possible split-screen use is flagged. Three flags automatically forfeit the battle.</p></details>
    {warning ? <Alert tone="warning" role="status" title={`Battle activity flagged (${strikes}/3 saved)`}>Stay in this battle window. The third recorded flag automatically forfeits this battle.</Alert> : null}
    {unsaved ? <Alert tone="warning" role="status" title="Flag could not be saved">Keep this battle open. We will retry while you are connected.</Alert> : null}
    {children}
  </div>;
}
