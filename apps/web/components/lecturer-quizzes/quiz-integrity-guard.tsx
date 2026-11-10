"use client";

import { useEffect, useState } from "react";
import { captureShortcut, observeAssessmentWindow, type CaptureShortcut, type WindowActivity } from "@/lib/assessment-activity";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Signal = WindowActivity | CaptureShortcut;
type Activity = { id: string; kind: Signal };
const signals: Signal[] = ["app_hidden", "focus_lost", "possible_split_screen", "fullscreen_exit", "screenshot_shortcut", "recording_shortcut", "casting_shortcut"];
export const QUIZ_FLAG_DISPLAY_MAX = 3;

export function QuizIntegrityGuard({
  attemptId,
  active,
  onFlagsChange,
}: {
  attemptId: string;
  active: boolean;
  onFlagsChange?: (flags: number, pendingUpload: boolean) => void;
}) {
  const [flags, setFlags] = useState(0);
  const [unsaved, setUnsaved] = useState(false);

  useEffect(() => {
    onFlagsChange?.(flags, unsaved);
  }, [flags, unsaved, onFlagsChange]);

  useEffect(() => {
    if (!active) return;
    const key = `quiz-integrity:${attemptId}`;
    let pending: Activity[] = [];
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]");
      if (Array.isArray(saved)) pending = saved.filter((item) => item && typeof item.id === "string" && signals.includes(item.kind)).slice(0, 100);
    } catch { /* Retry in memory if storage is unavailable. */ }
    const persist = () => {
      try {
        if (pending.length) sessionStorage.setItem(key, JSON.stringify(pending));
        else sessionStorage.removeItem(key);
      } catch { /* Retry in memory if storage is unavailable. */ }
    };
    let sending = false;
    let stopped = false;
    let closed = false;
    const last = new Map<Signal, number>();

    async function flush() {
      if (sending || !pending.length || closed) return;
      sending = true;
      try {
        const client = getBrowserSupabase();
        while (pending.length) {
          const event = pending[0]!;
          const { data, error } = await client.rpc("report_lecturer_quiz_integrity_v1", {
            p_attempt_id: attemptId, p_event_id: event.id, p_kind: event.kind,
          });
          if (error) throw error;
          closed = data?.closed === true;
          if (typeof data?.flags === "number") setFlags(data.flags);
          else if (!closed) setFlags(current => Math.max(current, 1));
          if (closed) pending = [];
          else pending.shift();
          persist();
        }
        if (!stopped) setUnsaved(false);
      } catch {
        if (!stopped) setUnsaved(true);
      } finally { sending = false; }
    }
    function flag(kind: Signal) {
      if (closed || Date.now() - (last.get(kind) ?? 0) < 3000) return;
      last.set(kind, Date.now());
      if (pending.length < 100) pending.push({ id: crypto.randomUUID(), kind });
      persist();
      setFlags(current => Math.min(QUIZ_FLAG_DISPLAY_MAX, Math.max(current + 1, pending.length)));
      void flush();
    }
    function onKey(event: KeyboardEvent) {
      if (!event.isTrusted || event.repeat) return;
      const shortcut = captureShortcut(event, navigator.platform);
      if (shortcut) flag(shortcut);
    }

    const stopObserving = observeAssessmentWindow(flag, () => void flush());
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("online", flush);
    const retry = setInterval(() => void flush(), 5000);
    void flush();

    return () => {
      stopped = true;
      stopObserving();
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("online", flush);
      clearInterval(retry);
      void flush();
    };
  }, [active, attemptId]);

  return null;
}

export function formatQuizFlagLabel(flags: number, pendingUpload = false) {
  if (flags <= 0 && !pendingUpload) return null;
  const shown = Math.min(Math.max(flags, pendingUpload ? 1 : 0), QUIZ_FLAG_DISPLAY_MAX);
  const base = `Flag ${shown}/${QUIZ_FLAG_DISPLAY_MAX}`;
  return pendingUpload ? `${base} · pending` : base;
}
