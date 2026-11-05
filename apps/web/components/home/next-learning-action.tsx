"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

type Action = {
  kind: "review" | "gap" | "lesson";
  title: string;
  course_code: string;
  lesson_id: string;
  review_stage?: number;
  href: string;
};

export function NextLearningAction() {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const { data, error: rpcError } = await getBrowserSupabase().rpc("get_my_next_learning_action_v1");
    if (!rpcError) setAction(data?.action ?? null);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function beginReview() {
    if (!action || !action.review_stage) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: rpcError } = await getBrowserSupabase().rpc("start_topic_review_v1", {
        p_lesson_id: action.lesson_id, p_stage: action.review_stage, p_request_key: crypto.randomUUID(),
      });
      if (rpcError || !data?.attempt_id) throw rpcError ?? new Error("Review unavailable");
      router.push("/attempts/" + data.attempt_id);
    } catch {
      setError("Couldn't start the review. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (!action) return null;
  return (
    <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface-card p-4" aria-labelledby="up-next-heading">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">One useful next step</p>
        <h2 id="up-next-heading" className="text-lg font-bold">{action.kind === "review" ? "Review what you learned" : action.kind === "gap" ? "Strengthen a weak topic" : "Continue learning"}</h2>
        <p className="text-sm text-ink-muted">{action.course_code} · {action.title}</p>
      </div>
      {action.kind === "review" ? (
        <Button loading={busy} onClick={() => void beginReview()}>Start due review</Button>
      ) : (
        <Button asChild><Link href={action.href}>{action.kind === "gap" ? "Relearn topic" : "Open lesson"}</Link></Button>
      )}
      {error ? <p role="status" className="w-full text-sm text-danger">{error}</p> : null}
    </section>
  );
}
