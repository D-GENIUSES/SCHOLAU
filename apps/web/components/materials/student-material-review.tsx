"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { LecturerPageHeader } from "@/components/lecturer/page-header";

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
  const refresh = useCallback(async () => {
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
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);

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
    <section className="mx-auto max-w-3xl space-y-3">
      <LecturerPageHeader
        title="Submissions"
        description="Approve sources before draft generation. Final publication still needs content review."
        actions={<Button variant="outline" size="sm" onClick={() => void refresh()}>Refresh</Button>}
      />
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      {loading ? <p className="text-sm text-ink-muted">Loading submitted materials…</p> : pending.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-card">
          {pending.map((item) => (
            <li key={item.id} className="space-y-1.5 px-3.5 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold wrap-break-word">{item.filename}</h2>
                  <p className="text-xs text-ink-muted">{item.course_code} · {item.student_name} · {new Date(item.submitted_at).toLocaleDateString()}</p>
                </div>
                <a className="shrink-0 text-xs font-semibold text-brand-primary underline-offset-2 hover:underline" href={"/api/student-materials?submissionId=" + encodeURIComponent(item.id)} target="_blank" rel="noopener noreferrer">Download</a>
              </div>
              {item.notes ? <p className="line-clamp-2 text-sm text-ink-muted">{item.notes}</p> : null}
              <div className="flex flex-wrap gap-2 pt-0.5">
                <Button size="sm" loading={busy === item.id} onClick={() => void decide(item.id, "approved")}>Approve</Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void decide(item.id, "rejected")}>Reject</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-card border border-line px-3.5 py-4 text-sm text-ink-muted">No student submissions are awaiting review.</p>}
    </section>
  );
}
