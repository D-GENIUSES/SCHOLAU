"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

type HeatmapRow = {
  topic_key: string;
  topic_title: string;
  students: number;
  before_percent: number;
  after_percent: number;
  gain_percent: number;
};
export default function LecturerTopicHeatmap() {
  const { offeringId } = useParams<{ offeringId: string }>();
  const [rows, setRows] = useState<HeatmapRow[]>([]);
  const [suppressed, setSuppressed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      const { data, error } = await getBrowserSupabase().rpc("get_lecturer_topic_heatmap_v1", { p_offering_id: offeringId });
      if (error) throw error;
      setRows(data?.rows ?? []);
      setSuppressed(data?.suppressed_cells ?? 0);
      setMessage("");
    } catch {
      setMessage("The class heatmap is unavailable. Check your course assignment and try again.");
    } finally {
      setLoading(false);
    }
  }, [offeringId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  return (
    <main className="mx-auto max-w-4xl space-y-5">
      <Link href="/lecturer" className="text-brand-primary underline">Back to my courses</Link>
      <h1 className="text-2xl font-bold">Class topic heatmap</h1>
      <p className="text-sm text-ink-muted">Based on students enrolled in this course who completed both topic checks. Small groups are hidden; no individual answers or student names are shown.</p>
      <Button variant="outline" size="sm" onClick={() => void load()}>Refresh class results</Button>
      {message ? <p role="status">{message}</p> : null}
      {loading ? <p>Loading class topics…</p> : rows.length ? (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[580px] text-left text-sm">
            <thead className="bg-surface-page">
              <tr><th className="p-3">Topic</th><th className="p-3">Learners</th><th className="p-3">Before</th><th className="p-3">After</th><th className="p-3">Change</th></tr>
            </thead>
            <tbody>{rows.map(row => (
              <tr key={row.topic_key} className="border-t border-line">
                <th scope="row" className="p-3">{row.topic_title}</th>
                <td className="p-3">{row.students}</td>
                <td className="p-3">{row.before_percent}%</td>
                <td className="p-3">{row.after_percent}%</td>
                <td className="p-3">{row.gain_percent > 0 ? "+" : ""}{row.gain_percent}%</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p>No class-level topic data meets the five-student privacy threshold yet.</p>}
      {suppressed ? <p className="text-sm text-ink-muted">{suppressed} small topic groups were hidden to protect student privacy.</p> : null}
    </main>
  );
}
