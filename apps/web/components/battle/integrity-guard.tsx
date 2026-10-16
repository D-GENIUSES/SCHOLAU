"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/alert";

type Signal = "app_hidden" | "focus_lost" | "possible_split_screen" | "fullscreen_exit" | "copy_attempt";

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
    let away = false;
    let smallWindow = false;
    let resizeTimer: ReturnType<typeof setTimeout>;
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
    const departure = (kind: Signal) => { if (!away) { away = true; flag(kind); } };
    const focus = () => { if (!document.hidden && document.hasFocus()) away = false; void flush(); };
    const visibility = () => { if (document.hidden) departure("app_hidden"); else focus(); };
    const blur = () => departure("focus_lost");
    const fullscreen = () => { if (!document.fullscreenElement) flag("fullscreen_exit"); };
    // Compare window dimensions rather than viewport dimensions to avoid flagging zoom/keyboard.
    const checkWindow = () => {
      const { availWidth: width, availHeight: height } = window.screen;
      const small = width > 0 && height > 0 && window.outerWidth > 0 && window.outerHeight > 0 &&
        (window.outerWidth < width * 0.75 || window.outerHeight < height * 0.65);
      if (small && !smallWindow) flag("possible_split_screen");
      smallWindow = small;
    };
    const resize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(checkWindow, 1000); };
    const protect = (event: Event) => {
      event.preventDefault();
      if (event.type === "copy" || event.type === "cut") flag("copy_attempt");
    };
    const element = root.current;
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("fullscreenchange", fullscreen);
    window.addEventListener("resize", resize);
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
    checkWindow();
    visibility();
    return () => {
      disposed = true;
      clearTimeout(resizeTimer);
      clearInterval(retry);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("fullscreenchange", fullscreen);
      window.removeEventListener("resize", resize);
      window.removeEventListener("online", flush);
      for (const name of ["copy", "cut", "contextmenu", "dragstart", "selectstart"]) element?.removeEventListener(name, protect);
      void flush();
    };
  }, [battleId, onForfeit]);

  return <div ref={root} className="flex select-none flex-col gap-4" style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}>
    <p className="text-sm text-ink-muted">Fair play: stay in this app, use a full window, and do not share your screen. Copying battle text is disabled. Leaving, losing focus, or possible split-screen use is flagged. Three flags automatically forfeit the battle.</p>
    {warning ? <Alert tone="warning" role="status" title={`Battle activity flagged (${strikes}/3 saved)`}>Return to a full battle window. The third recorded flag automatically forfeits this battle.</Alert> : null}
    {unsaved ? <Alert tone="warning" role="status" title="Flag could not be saved">Keep this battle open. We will retry while you are connected.</Alert> : null}
    {children}
  </div>;
}
