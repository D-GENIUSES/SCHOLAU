"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Assignment = {
  id: string;
  title: string;
  kind: "lesson" | "practice";
  target_id: string;
  due_at: string;
  completed: boolean;
};
export function CourseLightAssignments({ offeringId }: { offeringId: string }) {
  const [items, setItems] = useState<Assignment[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const { data, error: rpcError } = await getBrowserSupabase().rpc("list_light_assignments_v1", { p_offering_id: offeringId });
    if (rpcError) setError("Assignments could not be loaded.");
    else { setItems(data?.items ?? []); setError(""); }
  }, [offeringId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  if (!items.length && !error) return null;
  return (
    <section className="mb-6 space-y-3" aria-labelledby="course-assignments-title">
      <h2 id="course-assignments-title" className="text-xl font-bold">From your lecturer</h2>
      {error ? <p role="status" className="text-sm text-ink-muted">{error}</p> : null}
      <ul className="space-y-2">
        {items.map(item => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface-card p-4">
            <div><strong>{item.title}</strong><p className="text-sm text-ink-muted">{item.completed ? "Completed" : "To do"} · Due {new Date(item.due_at).toLocaleString()}</p></div>
            <Link className="font-semibold text-brand-primary underline" href={item.kind === "lesson"
              ? "/study/lessons/" + item.target_id
              : "/study/assessments/" + item.target_id + "?offering=" + encodeURIComponent(offeringId)}>
              {item.completed ? "Review again" : "Start"}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
