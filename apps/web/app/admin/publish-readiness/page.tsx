"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Offering = { id: string; code: string; title: string };
type Readiness = {
  lesson_id: string;
  version_id: string;
  title: string;
  status: string;
  ready: boolean;
  questions: number;
  has_example: boolean;
  has_checkpoint: boolean;
  flagged: boolean;
  issues: string[];
};

export default function PublishReadinessPage() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selected, setSelected] = useState("");
  const [rows, setRows] = useState<Readiness[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const loadOfferings = useCallback(async () => {
    const { data, error } = await getBrowserSupabase().rpc("get_material_ingestion_offerings_v1");
    if (error) { setMessage("Couldn't load courses for review."); return; }
    setOfferings(data?.items ?? []);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void loadOfferings(), 0);
    return () => window.clearTimeout(t);
  }, [loadOfferings]);
  async function inspect(courseId: string) {
    setSelected(courseId);
    setRows([]);
    if (!courseId) return;
    setLoading(true);
    setMessage("");
    try {
      const { data, error } = await getBrowserSupabase().rpc("get_course_publish_readiness_v1", { p_offering_id: courseId });
      if (error) throw error;
      setRows(data?.items ?? []);
    } catch {
      setMessage("Could not inspect this course's published or draft topic material.");
    } finally {
      setLoading(false);
    }
  }
  const ready = rows.filter(r => r.ready).length;
  return (
    <main className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold">Topic publish readiness</h1>
      <p className="text-sm text-ink-muted">Quality audit for each topic: worked example, checkpoint, at least three published reviewed questions, and no flagged source. This is a preflight report; the existing publication workflow still requires editorial approval.</p>
      <label className="block space-y-2"><span className="font-semibold">Course</span>
        <select value={selected} onChange={e=>void inspect(e.target.value)} className="w-full rounded-control border border-line p-3">
          <option value="">Select a course…</option>
          {offerings.map(c=><option key={c.id} value={c.id}>{c.code}: {c.title}</option>)}
        </select>
      </label>
      {loading ? <p>Checking topic readiness…</p> : selected ? <p role="status" className="text-sm">{ready} of {rows.length} topic lessons pass the editorial bar.</p> : null}
      {message ? <p role="status" className="text-sm text-danger">{message}</p> : null}
      <ul className="space-y-3">{rows.map(row=>(
        <li key={row.lesson_id} className="rounded-card border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">{row.title}</h2>
            <strong className={row.ready ? "text-success" : "text-warning"}>{row.ready ? "Ready" : "Needs review"}</strong>
          </div>
          <p className="mt-1 text-sm text-ink-muted">{row.status} · {row.questions} reviewed questions</p>
          {row.issues.length ? <ul className="mt-2 list-disc pl-5 text-sm">{row.issues.map(i=><li key={i}>{i}</li>)}</ul> : null}
        </li>
      ))}</ul>
      <Button asChild variant="outline"><Link href="/admin/review?tab=lessons&status=draft">Open draft review</Link></Button>
    </main>
  );
}
