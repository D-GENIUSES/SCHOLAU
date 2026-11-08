"use client";

import { MathText } from "@/components/math/math-text";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LecturerQuizDetail, LecturerQuizDraft, LecturerQuizQuestion } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Failure } from "@/components/challenges/course-challenges";
import { lecturerQuizApi, lecturerQuizError } from "@/lib/lecturer-quiz-api";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const api = () => lecturerQuizApi(getBrowserSupabase());
const subscribeZone = () => () => {};
const readZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
function localDateTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const emptyQuestion = (): LecturerQuizQuestion => ({ prompt: "", options: ["", "", "", ""], correct: 0, explanation: "" });

export function QuizEditor({ offering, initial }: { offering: string; initial?: LecturerQuizDetail }) {
  const router = useRouter();
  const id = useRef(initial?.quiz.id ?? "");
  const [revision, setRevision] = useState(initial?.quiz.revision ?? 0);
  const [draft, setDraft] = useState<LecturerQuizDraft>(() =>
    initial
      ? {
          title: initial.quiz.title,
          instructions: initial.quiz.instructions,
          duration_minutes: initial.quiz.duration_minutes,
          opens_at: initial.quiz.opens_at,
          closes_at: initial.quiz.closes_at,
          max_attempts: initial.quiz.max_attempts,
          feedback_mode: initial.quiz.feedback_mode,
          questions: initial.questions.length ? initial.questions : [],
        }
      : { title: "", instructions: "", duration_minutes: 30, opens_at: null, closes_at: null, max_attempts: 1, feedback_mode: "after_submit", questions: [] },
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const zone = useSyncExternalStore(subscribeZone, readZone, () => "");
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function change(next: Partial<LecturerQuizDraft>) { setDraft(d => ({ ...d, ...next })); setDirty(true); setMessage(""); }
  function question(index: number, next: Partial<LecturerQuizQuestion>) {
    change({ questions: draft.questions.map((q, i) => (i === index ? { ...q, ...next } : q)) });
  }
  async function save(publish: boolean) {
    setBusy(true); setError(null); setMessage("");
    try {
      if (!id.current) id.current = crypto.randomUUID();
      if (!draft.opens_at || !draft.closes_at) throw new Error("Set when the quiz opens and closes.");
      const saved = await api().save(id.current, offering, revision, draft);
      setRevision(saved.quiz.revision);
      setDraft(d => ({ ...d, questions: saved.questions }));
      setDirty(false);
      if (publish) {
        if (new Date(draft.closes_at!).getTime() <= Date.now()) throw new Error("Close time must be in the future.");
        await api().publish(id.current, saved.quiz.revision);
        router.push(`/lecturer/courses/${offering}/quizzes/${id.current}`);
        router.refresh();
      } else setMessage("Draft saved.");
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function uploadImport(file: File) {
    if (!id.current) id.current = crypto.randomUUID();
    setImportBusy(true); setError(null);
    try {
      await api().save(id.current, offering, revision, { ...draft, questions: draft.questions.length ? draft.questions : [emptyQuestion()] });
      const body = new FormData();
      body.set("quizId", id.current);
      body.set("offeringId", offering);
      body.set("file", file);
      const res = await fetch("/api/lecturer-quiz-import", { method: "POST", body });
      const json = await res.json() as { questions?: LecturerQuizQuestion[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Import failed.");
      if (json.questions?.length) {
        change({ questions: json.questions });
        setMessage(`Imported ${json.questions.length} questions. Review before publishing.`);
      }
    } catch (e) { setError(e); } finally { setImportBusy(false); }
  }
  return (
    <form className="space-y-5 min-w-0" onSubmit={e => { e.preventDefault(); void save(false); }}>
      <Link className="inline-flex min-h-11 items-center underline" href={`/lecturer/courses/${offering}/quizzes`}>Back to quizzes</Link>
      <h1 className="text-2xl font-bold">{initial ? "Edit quiz" : "Create quiz"}</h1>
      <Failure error={error ? new Error(lecturerQuizError(error)) : null} />
      {message && <p role="status">{message}</p>}
      <fieldset disabled={busy || importBusy} className="space-y-4 min-w-0">
        <label className="block">Title<Input required maxLength={160} value={draft.title} onChange={e => change({ title: e.target.value })} /></label>
        <label className="block">Instructions<Textarea aria-label="Instructions" maxLength={4000} value={draft.instructions} onChange={e => change({ instructions: e.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>Duration per attempt (minutes, required)<Input type="number" min={1} max={180} required value={draft.duration_minutes} onChange={e => change({ duration_minutes: Number(e.target.value) })} /></label>
          <label>Max attempts<NativeSelect aria-label="Max attempts" value={draft.max_attempts ?? 1} onChange={e => change({ max_attempts: Number(e.target.value) })}>
            <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
          </NativeSelect></label>
        </div>
        <p className="text-sm text-ink-muted">Students can only open the quiz between the times below. Each student has {draft.duration_minutes} minutes once they start. Time zone: {zone || "Loading…"}.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">Opens<Input type="datetime-local" required className="min-w-0 max-w-full" value={localDateTime(draft.opens_at)} onChange={e => change({ opens_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
          <label className="block">Closes<Input type="datetime-local" required className="min-w-0 max-w-full" value={localDateTime(draft.closes_at)} onChange={e => change({ closes_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
        </div>
        <label className="block">After submit<NativeSelect aria-label="Feedback" value={draft.feedback_mode} onChange={e => change({ feedback_mode: e.target.value as "after_submit" | "immediate" })}>
          <option value="after_submit">Show correct answers after submit</option>
          <option value="immediate">Hide detailed feedback</option>
        </NativeSelect></label>
        <div className="rounded-xl border border-line p-4 space-y-2">
          <p className="font-semibold">Import from PDF or Word</p>
          <p className="text-sm text-ink-muted">AI extracts multiple-choice questions. Always review before publishing.</p>
          <Input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => { const f = e.target.files?.[0]; if (f) void uploadImport(f); e.target.value = ""; }} />
        </div>
        <h2 className="text-xl font-bold">Questions ({draft.questions.length}/100)</h2>
        {draft.questions.map((q, i) => (
          <section key={i} className="space-y-3 rounded-xl border border-line p-4 min-w-0">
            <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">Question {i + 1}</h3>
              <Button type="button" variant="secondary" onClick={() => change({ questions: draft.questions.filter((_, n) => n !== i) })}>Remove</Button></div>
            <label className="block">Question text<Textarea required maxLength={2000} value={q.prompt} onChange={e => question(i, { prompt: e.target.value })} /></label>
            <div className="grid gap-3 sm:grid-cols-2">{q.options.map((option, n) => (
              <label key={n}>Option {n + 1}<Input required maxLength={1000} value={option} onChange={e => question(i, { options: q.options.map((o, k) => (k === n ? e.target.value : o)) })} /></label>
            ))}</div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={q.options.length <= 2} onClick={() => question(i, { options: q.options.slice(0, -1), correct: Math.min(q.correct ?? 0, q.options.length - 2) })}>Remove option</Button>
              <Button type="button" variant="secondary" disabled={q.options.length >= 6} onClick={() => question(i, { options: [...q.options, ""] })}>Add option</Button>
            </div>
            <label className="block">Correct answer<NativeSelect value={q.correct ?? 0} onChange={e => question(i, { correct: Number(e.target.value) })}>{q.options.map((_, n) => <option key={n} value={n}>Option {n + 1}</option>)}</NativeSelect></label>
            <label className="block">Explanation (optional)<Textarea maxLength={4000} value={q.explanation ?? ""} onChange={e => question(i, { explanation: e.target.value })} /></label>
          </section>
        ))}
        <Button type="button" variant="secondary" disabled={draft.questions.length >= 100} onClick={() => change({ questions: [...draft.questions, emptyQuestion()] })}>Add question</Button>
        <p>Publishing freezes questions and schedule. Enrolled students receive a notification.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy}>Save draft</Button>
          <Button type="button" disabled={!draft.questions.length} onClick={e => {
            if (e.currentTarget.form?.reportValidity() && window.confirm("Publish this quiz? You cannot edit questions afterwards.")) void save(true);
          }}>Publish quiz</Button>
        </div>
      </fieldset>
    </form>
  );
}

export function QuizQuestionReview({ questions }: { questions: LecturerQuizQuestion[] }) {
  return <ol className="space-y-4">{questions.map((q, i) => (
    <li key={i} className="rounded-xl border border-line p-4 break-words"><p className="font-semibold"><MathText text={q.prompt} /></p>
      <ul className="mt-2 space-y-1">{q.options.map((o, n) => <li key={n} className={n === q.correct ? "font-semibold text-brand-primary" : ""}><MathText text={o} /></li>)}</ul>
      {q.explanation ? <p className="mt-2 text-sm text-ink-muted"><MathText text={q.explanation} /></p> : null}
    </li>
  ))}</ol>;
}
