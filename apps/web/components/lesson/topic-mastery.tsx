"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

type MasteryRow = {
  lesson_id: string;
  module_title: string;
  title: string;
  state: "not_started" | "learning" | "proficient" | "mastered";
  review_stage: number | null;
  review_due_at: string | null;
  review_due: boolean;
};
const labels: Record<MasteryRow["state"], string> = {
  not_started: "Not started",
  learning: "Learning",
  proficient: "Proficient",
  mastered: "Mastered",
};

/** Learning progress is distinct from the existing XP and lesson-completion badges. */
export function TopicMastery({ offeringId }: { offeringId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<MasteryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const { data, error: rpcError } = await getBrowserSupabase().rpc("get_course_topic_mastery_v1", { p_offering_id: offeringId });
      if (rpcError) throw rpcError;
      setRows(data?.items ?? []);
      setError("");
    } catch {
      setError("Topic mastery is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [offeringId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function beginReview(row: MasteryRow) {
    if (!row.review_stage) return;
    setBusy(row.lesson_id);
    setError("");
    try {
      const { data, error: rpcError } = await getBrowserSupabase().rpc("start_topic_review_v1", {
        p_lesson_id: row.lesson_id, p_stage: row.review_stage, p_request_key: crypto.randomUUID(),
      });
      if (rpcError || !data?.attempt_id) throw rpcError ?? new Error("This review could not be started.");
      router.push("/attempts/" + data.attempt_id);
    } catch {
      setError("Could not start your scheduled review. Try again.");
    } finally {
      setBusy(null);
    }
  }
  if (loading) return <p className="text-sm text-ink-muted">Checking topic mastery…</p>;
  if (error && !rows.length) return <p role="status" className="text-sm text-ink-muted">{error}</p>;
  const modules = [...new Set(rows.map((r) => r.module_title))];
  return (
    <section aria-labelledby="mastery-title" className="mb-6 space-y-4 rounded-card border border-line bg-surface-card p-4">
      <div>
        <h2 id="mastery-title" className="text-lg font-bold">Topic mastery</h2>
        <p className="text-sm text-ink-muted">Knowledge checks establish proficiency. Completing the 1, 7 and 30-day reviews demonstrates lasting mastery.</p>
      </div>
      {error ? <p role="status" className="text-sm text-danger">{error}</p> : null}
      {modules.map((module) => (
        <div key={module} className="space-y-2">
          <h3 className="font-semibold">{module}</h3>
          <ul className="space-y-2">
            {rows.filter((row) => row.module_title === module).map((row) => (
              <li key={row.lesson_id} className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-surface-page p-3">
                <div className="min-w-0">
                  <Link href={"/study/lessons/" + row.lesson_id} className="font-semibold text-brand-primary hover:underline">{row.title}</Link>
                  <p className="text-sm text-ink-muted">{labels[row.state]}{row.review_due ? " · Review due" : ""}</p>
                </div>
                {row.review_due && row.review_stage ? (
                  <Button size="sm" loading={busy === row.lesson_id} disabled={busy !== null}
                    onClick={() => void beginReview(row)}>Review now</Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
