"use client";

import { useCallback, useEffect, useState } from "react";
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
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">Aggregated topic checks · small groups hidden</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>Refresh</Button>
      </div>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      {loading ? (
        <p className="text-sm text-ink-muted">Loading class topics…</p>
      ) : rows.length ? (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-surface-page text-xs text-ink-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Topic</th>
                <th className="px-3 py-2 font-semibold">Learners</th>
                <th className="px-3 py-2 font-semibold">Before</th>
                <th className="px-3 py-2 font-semibold">After</th>
                <th className="px-3 py-2 font-semibold">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.topic_key} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 font-medium">{row.topic_title}</th>
                  <td className="px-3 py-2 tabular-nums">{row.students}</td>
                  <td className="px-3 py-2 tabular-nums">{row.before_percent}%</td>
                  <td className="px-3 py-2 tabular-nums">{row.after_percent}%</td>
                  <td className="px-3 py-2 tabular-nums">{row.gain_percent > 0 ? "+" : ""}{row.gain_percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-card border border-line px-3.5 py-4 text-sm text-ink-muted">
          No class-level topic data meets the five-student privacy threshold yet.
        </p>
      )}
      {suppressed ? (
        <p className="text-xs text-ink-muted">{suppressed} small topic groups were hidden to protect student privacy.</p>
      ) : null}
    </section>
  );
}
