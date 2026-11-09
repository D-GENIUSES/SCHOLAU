"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Target = { kind: "lesson" | "practice"; id: string; title: string };
type Assignment = { id: string; title: string; kind: string; due_at: string; status: string };

const field = "mt-1 block w-full rounded-control border border-line bg-surface-card px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand-primary";

export default function ManageCourseAssignments() {
  const { offeringId } = useParams<{ offeringId: string }>();
  const [targets, setTargets] = useState<Target[]>([]);
  const [items, setItems] = useState<Assignment[]>([]);
  const [target, setTarget] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const client = getBrowserSupabase();
      const [available, assigned] = await Promise.all([
        client.rpc("get_light_assignment_targets_v1", { p_offering_id: offeringId }),
        client.rpc("list_light_assignments_v1", { p_offering_id: offeringId }),
      ]);
      if (available.error || assigned.error) throw available.error ?? assigned.error;
      setTargets(available.data?.items ?? []);
      setItems(assigned.data?.items ?? []);
    } catch {
      setMessage("Couldn't load assignments for this course. Check your lecturer access.");
    }
  }, [offeringId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = targets.find((item) => item.kind + ":" + item.id === target);
    if (!chosen || !due || !title.trim()) return;
    const date = new Date(due);
    if (Number.isNaN(date.getTime())) { setMessage("Choose a valid due date."); return; }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await getBrowserSupabase().rpc("create_light_assignment_v1", {
        p_offering_id: offeringId,
        p_title: title.trim(),
        p_lesson_id: chosen.kind === "lesson" ? chosen.id : null,
        p_assessment_version_id: chosen.kind === "practice" ? chosen.id : null,
        p_due_at: date.toISOString(),
      });
      if (error) throw error;
      setTitle("");
      setTarget("");
      setDue("");
      setMessage("Assignment published to enrolled students. There is no single-attempt restriction or challenge timer.");
      await refresh();
    } catch {
      setMessage("Could not publish the assignment. Verify the target and date.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (!window.confirm("Cancel this assignment? Student work stays recorded.")) return;
    setBusy(true);
    try {
      const { error } = await getBrowserSupabase().rpc("cancel_light_assignment_v1", { p_assignment_id: id });
      if (error) throw error;
      setMessage("Assignment cancelled.");
      await refresh();
    } catch {
      setMessage("Could not cancel this assignment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <p className="text-xs text-ink-muted">Assign a published lesson or untimed practice set with a due date.</p>
      <form onSubmit={create} className="space-y-2.5 rounded-card border border-line bg-surface-card p-3.5">
        <label className="block text-xs font-semibold">Title
          <input className={field} value={title} maxLength={160} required onChange={(e) => setTitle(e.target.value)} placeholder="Revise probability basics by Friday" />
        </label>
        <label className="block text-xs font-semibold">Lesson or practice
          <select className={field} value={target} required onChange={(e) => setTarget(e.target.value)}>
            <option value="">Select published content…</option>
            {targets.map((item) => (
              <option key={item.kind + item.id} value={item.kind + ":" + item.id}>
                {item.kind === "lesson" ? "Lesson" : "Practice"}: {item.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold">Due date
          <input className={field} type="datetime-local" required value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <Button type="submit" size="sm" loading={busy} disabled={busy || !target || !due || !title.trim()}>Assign</Button>
      </form>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">Published</h2>
        {items.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-card">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-ink-muted">{item.kind} · Due {new Date(item.due_at).toLocaleString()} · {item.status}</p>
                </div>
                {item.status === "active" ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void cancel(item.id)}>Cancel</Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No assignments created yet.</p>
        )}
      </section>
    </section>
  );
}
