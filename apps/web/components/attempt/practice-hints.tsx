"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/math/math-text";

/** Hint text is separately approved. Correct answers and full explanations are never requested. */
export function PracticeHints({ attemptId, questionVersionId }: { attemptId: string; questionVersionId: string }) {
  const [hints, setHints] = useState<string[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function nextHint() {
    if (busy || (total !== null && hints.length >= total)) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await getBrowserSupabase().rpc("get_practice_hint_v1", {
        p_attempt_id: attemptId,
        p_question_version_id: questionVersionId,
        p_step: hints.length + 1,
      });
      if (error) throw error;
      setTotal(data?.hint_count ?? 0);
      if (data?.hint) setHints(previous => [...previous, data.hint]);
      else setMessage("No step-by-step hints have been approved for this question yet.");
    } catch {
      setMessage("Could not load this hint. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="rounded-control border border-line bg-surface-page p-3" aria-label="Practice hints">
      <p className="text-sm font-semibold">Need a nudge?</p>
      <p className="mt-1 text-xs text-ink-muted">Hints reveal one step at a time. The complete solution appears only after you submit your practice attempt.</p>
      {hints.length ? <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
        {hints.map((hint, index) => <li key={index}><MathText text={hint} /></li>)}
      </ol> : null}
      {total === null || hints.length < total ? (
        <Button size="sm" variant="outline" className="mt-3" loading={busy}
          onClick={() => void nextHint()}>{hints.length ? "Show next hint" : "Show first hint"}</Button>
      ) : null}
      {message ? <p role="status" className="mt-2 text-sm text-ink-muted">{message}</p> : null}
    </aside>
  );
}
