"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Target = { kind: "lesson" | "practice"; id: string; title: string };
type Assignment = { id: string; title: string; kind: string; due_at: string; status: string };

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
    <main className="mx-auto max-w-3xl space-y-5">
      <Link href="/lecturer" className="text-brand-primary underline">Back to my courses</Link>
      <h1 className="text-2xl font-bold">Light assignments</h1>
      <p className="text-sm text-ink-muted">Give students an existing lesson or untimed practice set to finish by a date. This does not create a challenge, affect official grades or restrict attempts.</p>
      <form onSubmit={create} className="space-y-3 rounded-card border border-line p-5">
        <label className="block space-y-1"><span className="font-semibold">Assignment title</span>
          <input className="w-full rounded-control border border-line p-3" value={title} maxLength={160} required onChange={e=>setTitle(e.target.value)} placeholder="Revise probability basics by Friday" /></label>
        <label className="block space-y-1"><span className="font-semibold">Lesson or practice set</span>
          <select className="w-full rounded-control border border-line p-3" value={target} required onChange={e=>setTarget(e.target.value)}>
            <option value="">Select published content…</option>
            {targets.map(item => <option key={item.kind + item.id} value={item.kind + ":" + item.id}>{item.kind === "lesson" ? "Lesson" : "Practice"}: {item.title}</option>)}
          </select></label>
        <label className="block space-y-1"><span className="font-semibold">Due date and local time</span>
          <input className="w-full rounded-control border border-line p-3" type="datetime-local" required value={due} onChange={e=>setDue(e.target.value)} /></label>
        <Button type="submit" loading={busy} disabled={busy || !target || !due || !title.trim()}>Assign to course</Button>
      </form>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Assignments</h2>
        {items.length ? <ul className="space-y-2">{items.map(item => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line p-3">
            <div><strong>{item.title}</strong><p className="text-sm text-ink-muted">{item.kind} · Due {new Date(item.due_at).toLocaleString()} · {item.status}</p></div>
            {item.status === "active" ? <Button size="sm" variant="outline" disabled={busy} onClick={()=>void cancel(item.id)}>Cancel</Button> : null}
          </li>
        ))}</ul> : <p className="text-sm text-ink-muted">No assignments created yet.</p>}
      </section>
    </main>
  );
}
