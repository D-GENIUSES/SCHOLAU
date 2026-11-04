"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

type Material = {
  id: string;
  offering_id: string;
  course_code: string;
  filename: string;
  notes: string;
  status: string;
  submitted_at: string;
  student_name: string;
  reviewer_note?: string | null;
};

export function StudentMaterialReview() {
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function refresh() {
    setLoading(true);
    try {
      const { data, error } = await getBrowserSupabase().rpc("list_student_materials_v1");
      if (error) throw error;
      setItems(data?.items ?? []);
    } catch {
      setMessage("Could not load the material review queue.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function decide(id: string, decision: "approved" | "rejected") {
    const note = decision === "rejected" ? window.prompt("Reason for rejection (optional, maximum 500 characters):") : "";
    if (note === null || (note?.length ?? 0) > 500) return;
    setBusy(id);
    setMessage("");
    try {
      const { error } = await getBrowserSupabase().rpc("review_student_material_v1", {
        p_submission_id: id, p_decision: decision, p_note: note ?? "",
      });
      if (error) throw error;
      setMessage(decision === "approved"
        ? "Approved. The source is queued for draft generation. New lessons and questions still need editorial review."
        : "Rejected. The source has not been processed.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save review.");
    } finally {
      setBusy(null);
    }
  }
  const pending = items.filter((item) => item.status === "pending");
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Student source submissions</h1>
      <p className="text-sm text-ink-muted">Only approved sources enter draft generation. Review ownership, quality, relevance and personal information before approving. Final publication uses the separate content review process.</p>
      <Button variant="outline" size="sm" onClick={() => void refresh()}>Refresh</Button>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      {loading ? <p>Loading submitted materials…</p> : pending.length ? (
        <ul className="space-y-3">
          {pending.map((item) => (
            <li key={item.id} className="space-y-2 rounded-card border border-line p-4">
              <h2 className="font-semibold">{item.filename}</h2>
              <p className="text-sm">{item.course_code} · Submitted by {item.student_name}</p>
              {item.notes ? <p className="text-sm text-ink-muted">{item.notes}</p> : null}
              <p className="text-xs text-ink-muted">Submitted {new Date(item.submitted_at).toLocaleDateString()}</p>
              <div className="flex gap-3">
                <Button size="sm" loading={busy === item.id} onClick={() => void decide(item.id, "approved")}>Approve for draft generation</Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void decide(item.id, "rejected")}>Reject</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p>No student submissions are awaiting review.</p>}
    </section>
  );
}
