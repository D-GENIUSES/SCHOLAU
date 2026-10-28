"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChallengeDetail, ChallengeDraft, ChallengeQuestion } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { api, Failure, Paging } from "./course-challenges";
const subscribeZone = () => () => {};
const readZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
function localDateTime(value?: string | null) { if (!value) return ""; const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
const emptyQuestion = (): ChallengeQuestion => ({ prompt: "", options: ["", "", "", ""], correct: 0, explanation: "" });
export function ChallengeEditor({ offering, initial }: { offering: string; initial?: ChallengeDetail }) {
  const router = useRouter();
  const queries = useQueryClient();
  const id = useRef(initial?.challenge.id ?? "");
  const [revision, setRevision] = useState(initial?.challenge.revision ?? 0);
  const [draft, setDraft] = useState<ChallengeDraft>(() => initial ? { title: initial.challenge.title, instructions: initial.challenge.instructions, duration_minutes: initial.challenge.duration_minutes, questions: initial.questions } : { title: "", instructions: "", duration_minutes: 15, questions: [] });
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null), [message, setMessage] = useState("");
  const [mode, setMode] = useState(initial?.challenge.starts_at ? "scheduled" : "now"), [start, setStart] = useState(() => localDateTime(initial?.challenge.starts_at));
  const [bankOpen, setBankOpen] = useState(false), [search, setSearch] = useState(""), [offset, setOffset] = useState(0);
  const bank = useQuery({ queryKey: ["challenge-bank", offering, search, offset], queryFn: () => api().bank(offering, search, offset), enabled: bankOpen });
  const zone = useSyncExternalStore(subscribeZone, readZone, () => "");
  useEffect(() => { if (!dirty) return; const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [dirty]);
  function change(next: Partial<ChallengeDraft>) { setDraft(d => ({ ...d, ...next })); setDirty(true); setMessage(""); }
  function question(index: number, next: Partial<ChallengeQuestion>) { change({ questions: draft.questions.map((q, i) => i === index ? { ...q, ...next } : q) }); }
  async function save(publish: boolean) {
    setBusy(true); setError(null); setMessage("");
    try {
      if (!id.current) id.current = crypto.randomUUID();
      const saved = await api().save(id.current, offering, revision, { ...draft, starts_at: mode === "scheduled" && start ? new Date(start).toISOString() : null });
      setRevision(saved.challenge.revision); setDraft(d => ({ ...d, questions: saved.questions })); setDirty(false);
      if (publish) {
        if (mode === "scheduled" && (!start || new Date(start).getTime() <= Date.now())) throw Error("Choose a future start time.");
        await api().publish(id.current, saved.challenge.revision, mode === "now" ? null : new Date(start).toISOString());
        await queries.invalidateQueries({ queryKey: ["challenge", id.current] });
        await queries.invalidateQueries({ queryKey: ["course-challenges", offering] });
        router.push(`/challenges/${id.current}`); router.refresh();
      } else { setMessage("Draft saved."); }
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function recover() {
    if (!id.current) return;
    if (dirty && !window.confirm("Reload the saved draft? Unsaved changes will be replaced.")) return;
    setBusy(true);
    try { const result = await api().detail(id.current); if (result.challenge.state !== "draft") { router.push(`/challenges/${id.current}`); router.refresh(); return; } setRevision(result.challenge.revision); setDraft({ ...result.challenge, questions: result.questions }); setMode(result.challenge.starts_at ? "scheduled" : "now"); setStart(localDateTime(result.challenge.starts_at)); setDirty(false); setError(null); } catch (e) { setError(e); } finally { setBusy(false); }
  }
  return <form className="space-y-5 min-w-0" onSubmit={e => { e.preventDefault(); void save(false); }}>
    <Link className="inline-flex min-h-11 items-center underline" href={`/courses/${offering}/challenges`} onClick={e => { if (dirty && !window.confirm("Leave without saving your changes?")) e.preventDefault(); }}>Back to challenges</Link>
    <h1 className="text-2xl font-bold">{initial ? "Edit challenge" : "Create challenge"}</h1>
    <Failure error={error} retry={() => void recover()} />{message && <p role="status">{message}</p>}
    <fieldset disabled={busy} className="space-y-4 min-w-0">
      <label className="block">Title<Input required maxLength={160} value={draft.title} onChange={e => change({ title: e.target.value })} /></label>
      <label className="block">Instructions<Textarea aria-label="Instructions" maxLength={4000} value={draft.instructions} onChange={e => change({ instructions: e.target.value })} /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label>Duration (minutes)<Input type="number" min={1} max={180} required value={draft.duration_minutes} onChange={e => change({ duration_minutes: Number(e.target.value) })} /></label><label>Start<NativeSelect aria-label="Start" value={mode} onChange={e => setMode(e.target.value)}><option value="now">Start immediately on publication</option><option value="scheduled">Schedule for later</option></NativeSelect></label></div>
      <p className="text-sm">Time zone: {zone || "Loading…"}. Everyone shares the same closing time. Late arrivals use the time remaining.</p>
      {mode === "scheduled" && <label className="block">Start date and time<Input type="datetime-local" className="min-w-0 max-w-full" value={start} onChange={e => setStart(e.target.value)} /></label>}
      <h2 className="text-xl font-bold">Questions ({draft.questions.length}/100)</h2>
      {draft.questions.map((q, i) => <section key={i} className="space-y-3 rounded-xl border border-line p-4 min-w-0"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">Question {i + 1}{q.source_version_id ? " · From course bank" : ""}</h3><Button type="button" variant="secondary" onClick={() => change({ questions: draft.questions.filter((_, n) => n !== i) })}>Remove question {i + 1}</Button></div>
        <label className="block">Question {i + 1} text<Textarea aria-label={`Question ${i + 1} text`} required maxLength={2000} readOnly={Boolean(q.source_version_id)} value={q.prompt} onChange={e => question(i, { prompt: e.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-2">{q.options.map((option, n) => <label key={n}>Question {i + 1} option {n + 1}<Input required maxLength={1000} readOnly={Boolean(q.source_version_id)} value={option} onChange={e => question(i, { options: q.options.map((o, k) => k === n ? e.target.value : o) })} /></label>)}</div>
        <label className="block">Correct answer for question {i + 1}<NativeSelect aria-label={`Correct answer for question ${i + 1}`} disabled={Boolean(q.source_version_id)} value={q.correct} onChange={e => question(i, { correct: Number(e.target.value) })}>{q.options.map((_, n) => <option value={n} key={n}>Option {n + 1}</option>)}</NativeSelect></label>
        <label className="block">Explanation for question {i + 1} (optional)<Textarea aria-label={`Explanation for question ${i + 1} (optional)`} maxLength={4000} readOnly={Boolean(q.source_version_id)} value={q.explanation ?? ""} onChange={e => question(i, { explanation: e.target.value })} /></label>
      </section>)}
      <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={draft.questions.length >= 100} onClick={() => change({ questions: [...draft.questions, emptyQuestion()] })}>Write a question</Button><Button type="button" variant="secondary" onClick={() => setBankOpen(v => !v)}>{bankOpen ? "Close question bank" : "Choose from course bank"}</Button></div>
      {bankOpen && <section aria-label="Course question bank" className="space-y-3 border border-line rounded-xl p-3"><label className="block">Search questions<Input maxLength={100} value={search} onChange={e => { setSearch(e.target.value); setOffset(0); }} /></label><Failure error={bank.error} retry={() => void bank.refetch()} />{bank.isPending && <p role="status">Loading question bank…</p>}<ul className="max-h-96 overflow-y-auto space-y-3">{bank.data?.items.map(q => <li key={q.source_version_id} className="border-b border-line pb-3 break-words"><p>{q.prompt}</p><Button type="button" variant="secondary" disabled={draft.questions.length >= 100 || draft.questions.some(x => x.source_version_id === q.source_version_id)} onClick={() => change({ questions: [...draft.questions, q] })}>Add question</Button></li>)}</ul>{bank.data && !bank.data.items.length && <p>No matching multiple-choice questions. You can write your own.</p>}<Paging offset={offset} hasMore={bank.data?.items.length === 20} change={setOffset} /></section>}
      <p>Publishing freezes the questions and timing. Results appear only after the challenge closes.</p>
      <div className="flex flex-wrap gap-2"><Button type="submit" loading={busy}>Save draft</Button><Button type="button" disabled={!draft.questions.length} onClick={e => { if (e.currentTarget.form?.reportValidity() && window.confirm(mode === "now" ? "Publish and start this challenge now? Questions cannot be edited afterwards." : "Publish this scheduled challenge? Questions and timing cannot be edited afterwards.")) void save(true); }}>{mode === "now" ? "Publish and start" : "Publish scheduled challenge"}</Button></div>
      {revision > 0 && <Button type="button" variant="secondary" onClick={async () => { if (!window.confirm("Cancel this draft?")) return; setBusy(true); try { await api().cancel(id.current); setDirty(false); await queries.invalidateQueries({ queryKey: ["challenge", id.current] }); await queries.invalidateQueries({ queryKey: ["course-challenges", offering] }); router.push(`/courses/${offering}/challenges`); } catch (e) { setError(e); setBusy(false); } }}>Cancel draft</Button>}
    </fieldset>
  </form>;
}
