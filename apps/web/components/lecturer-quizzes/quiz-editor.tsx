"use client";

import { MathText } from "@/components/math/math-text";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@scholau/api";
import { useRouter } from "next/navigation";
import {
  completeQuizQuestions,
  publishBlockers,
  scheduleStepIssue,
  type QuizEditorStep,
} from "@scholau/core";
import type { LecturerQuizDetail, LecturerQuizDraft, LecturerQuizQuestion } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Failure } from "@/components/challenges/course-challenges";
import { defaultQuizWindow, formatQuizWindow } from "./quiz-ui";
import { lecturerQuizApi, lecturerQuizError } from "@/lib/lecturer-quiz-api";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const api = () => lecturerQuizApi(getBrowserSupabase());
const subscribeZone = () => () => {};
const readZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
function localDateTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const emptyQuestion = (): LecturerQuizQuestion => ({ prompt: "", options: ["", "", "", ""], correct: 0, explanation: "" });
const steps: QuizEditorStep[] = ["Schedule", "Questions", "Review"];

export function QuizEditor({ offering, initial }: { offering: string; initial?: LecturerQuizDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [id, setId] = useState(initial?.quiz.id ?? "");
  const [revision, setRevision] = useState(initial?.quiz.revision ?? null);
  const defaults = defaultQuizWindow();
  const [step, setStep] = useState<QuizEditorStep>("Schedule");
  const [stepError, setStepError] = useState<string | null>(null);
  const [openQuestions, setOpenQuestions] = useState<Record<number, boolean>>({ 0: true });
  const [importReview, setImportReview] = useState<LecturerQuizQuestion[] | null>(null);
  const [importSession, setImportSession] = useState(0);
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
      : { title: "", instructions: "", duration_minutes: 30, opens_at: defaults.opens_at, closes_at: defaults.closes_at, max_attempts: 1, feedback_mode: "after_submit", questions: [] },
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const zone = useSyncExternalStore(subscribeZone, readZone, () => "");

  const scheduleIssue = useMemo(() => scheduleStepIssue(draft), [draft]);
  const readyCount = useMemo(() => completeQuizQuestions(draft.questions).length, [draft.questions]);
  const incompleteCount = draft.questions.length - readyCount;
  const canOpenQuestions = !scheduleIssue;
  const canOpenReview = canOpenQuestions;

  const scheduleWarning = useMemo(() => {
    if (!draft.opens_at || !draft.closes_at) return null;
    const windowMin = (new Date(draft.closes_at).getTime() - new Date(draft.opens_at).getTime()) / 60_000;
    if (draft.duration_minutes > windowMin) {
      return `Each attempt allows ${draft.duration_minutes} minutes, but the quiz window is only ${Math.floor(windowMin)} minutes long. Late starters may have less time than you set.`;
    }
    return null;
  }, [draft.closes_at, draft.duration_minutes, draft.opens_at]);

  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  function change(next: Partial<LecturerQuizDraft>) {
    setDraft(d => ({ ...d, ...next }));
    setDirty(true);
    setMessage("");
    setStepError(null);
  }
  function question(index: number, next: Partial<LecturerQuizQuestion>) {
    change({ questions: draft.questions.map((q, i) => (i === index ? { ...q, ...next } : q)) });
  }

  function goTo(next: QuizEditorStep) {
    if (next === "Questions" && scheduleIssue) {
      setStepError(scheduleIssue);
      setStep("Schedule");
      return;
    }
    if (next === "Review" && !canOpenReview) {
      setStepError(scheduleIssue ?? "Complete the schedule first.");
      setStep(scheduleIssue ? "Schedule" : "Questions");
      return;
    }
    setStepError(null);
    setStep(next);
  }

  async function save(publish: boolean) {
    const blocker = publishBlockers(draft, publish);
    if (blocker) {
      setStepError(blocker);
      setError(new Error(blocker));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    setStepError(null);
    try {
      const quizId = id || crypto.randomUUID();
      setId(quizId);
      const payload: LecturerQuizDraft = { ...draft, questions: completeQuizQuestions(draft.questions) };
      if (!draft.opens_at || !draft.closes_at) throw new Error("Set when the quiz opens and closes.");
      let savedRevision = revision;
      if (!publish || dirty || savedRevision === null) {
        const saved = await api().save(quizId, offering, revision ?? 0, payload);
        savedRevision = saved.quiz.revision;
        setRevision(savedRevision);
        setDraft(d => ({ ...d, questions: saved.questions }));
        setDirty(false);
      }
      if (publish && savedRevision !== null) {
        try {
          await api().publish(quizId, savedRevision);
        } catch (cause) {
          throw new Error(`Draft saved. Publication could not be confirmed. ${lecturerQuizError(cause)}`, { cause });
        }
        void queryClient.invalidateQueries({ queryKey: [...qk.classQuizzes(), offering] });
        void queryClient.invalidateQueries({ queryKey: ["course-quiz", quizId] });
        setMessage("Published. Enrolled students were notified.");
        router.push(`/lecturer/courses/${offering}/quizzes/${quizId}`);
        router.refresh();
      } else setMessage("Draft saved. Students cannot see this quiz until you publish.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function recover() {
    if (!id) return;
    if (dirty && !window.confirm("Reload the saved draft? Unsaved changes will be replaced.")) return;
    setBusy(true);
    try {
      const result = await api().detail(id);
      if (result.quiz.state !== "draft") {
        router.push(`/lecturer/courses/${offering}/quizzes/${id}`);
        router.refresh();
        return;
      }
      setRevision(result.quiz.revision);
      setDraft({
        title: result.quiz.title,
        instructions: result.quiz.instructions,
        duration_minutes: result.quiz.duration_minutes,
        opens_at: result.quiz.opens_at,
        closes_at: result.quiz.closes_at,
        max_attempts: result.quiz.max_attempts,
        feedback_mode: result.quiz.feedback_mode,
        questions: result.questions,
      });
      setDirty(false);
      setError(null);
      setStepError(null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function uploadImport(file: File) {
    const quizId = id || crypto.randomUUID();
    setId(quizId);
    setImportBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("quizId", quizId);
      body.set("offeringId", offering);
      body.set("file", file);
      const res = await fetch("/api/lecturer-quiz-import", { method: "POST", body });
      const json = await res.json() as { questions?: LecturerQuizQuestion[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Import failed.");
      if (json.questions?.length) {
        setImportSession(session => session + 1);
        setImportReview(json.questions);
        goTo("Questions");
      }
    } catch (e) {
      setError(e);
    } finally {
      setImportBusy(false);
    }
  }

  function mergeImport(selected: LecturerQuizQuestion[]) {
    change({ questions: [...draft.questions, ...selected] });
    setImportReview(null);
    setMessage(`Added ${selected.length} question${selected.length === 1 ? "" : "s"}. Review before publishing.`);
  }

  const publishIssue = publishBlockers(draft, true);
  const feedbackLabel = draft.feedback_mode === "immediate" ? "Score only (hide answer review)" : "Full answer review after submit";

  return (
    <form className="space-y-5 min-w-0" onSubmit={e => { e.preventDefault(); void save(false); }}>
      <Link
        className="inline-flex min-h-11 items-center underline"
        href={`/lecturer/courses/${offering}/quizzes`}
        onClick={e => { if (dirty && !window.confirm("Leave without saving your changes?")) e.preventDefault(); }}
      >
        Back to quizzes
      </Link>
      <h1 className="text-2xl font-bold">{initial ? "Edit quiz" : "Create quiz"}</h1>
      <nav aria-label="Quiz editor steps" className="flex flex-wrap gap-2">
        {steps.map((s, i) => {
          const locked = (s === "Questions" && !canOpenQuestions) || (s === "Review" && !canOpenReview);
          return (
            <button
              key={s}
              type="button"
              disabled={locked}
              onClick={() => goTo(s)}
              className={cn(
                "min-h-11 rounded-control px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand-primary",
                step === s ? "bg-surface-tint text-brand-primary" : "text-ink-muted hover:bg-surface-tint",
                locked && "opacity-50 cursor-not-allowed hover:bg-transparent",
              )}
            >
              {i + 1}. {s}
            </button>
          );
        })}
      </nav>
      <Failure
        error={error ? new Error(lecturerQuizError(error)) : null}
        retry={id ? () => void recover() : undefined}
      />
      {stepError ? <p role="alert" className="text-sm text-danger">{stepError}</p> : null}
      {message && <p role="status">{message}</p>}

      <fieldset disabled={busy || importBusy} className="space-y-4 min-w-0">
        {step === "Schedule" ? (
          <>
            <label className="block">Title<Input required maxLength={160} value={draft.title} onChange={e => change({ title: e.target.value })} /></label>
            <label className="block">Instructions<Textarea aria-label="Instructions" maxLength={4000} value={draft.instructions} onChange={e => change({ instructions: e.target.value })} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>Duration per attempt (minutes)<Input type="number" min={1} max={180} required value={draft.duration_minutes} onChange={e => change({ duration_minutes: Number(e.target.value) })} /></label>
              <label>Max attempts<NativeSelect aria-label="Max attempts" value={draft.max_attempts ?? 1} onChange={e => change({ max_attempts: Number(e.target.value) })}>
                <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
              </NativeSelect></label>
            </div>
            <p className="text-sm text-ink-muted">Students can only <strong>start</strong> between these times. Each student has <strong>{draft.duration_minutes} minutes</strong> once they begin. Times use your browser zone ({zone || "…"}).</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">Opens<Input type="datetime-local" required className="min-w-0 max-w-full" value={localDateTime(draft.opens_at)} onChange={e => change({ opens_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
              <label className="block">Closes<Input type="datetime-local" required className="min-w-0 max-w-full" value={localDateTime(draft.closes_at)} onChange={e => change({ closes_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => change(defaultQuizWindow())}>Use next 2-hour slot</Button>
            {scheduleWarning ? <p role="status" className="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-sm text-warning">{scheduleWarning}</p> : null}
            <label className="block">Student feedback after submit
              <NativeSelect aria-label="Feedback after submit" value={draft.feedback_mode} onChange={e => change({ feedback_mode: e.target.value as "after_submit" | "immediate" })}>
                <option value="after_submit">Show correct answers and explanations</option>
                <option value="immediate">Score only — hide correct answers</option>
              </NativeSelect>
            </label>
            <p className="text-sm text-ink-muted">Selected: {feedbackLabel}.</p>
            <div className="flex justify-end">
              <Button type="button" onClick={() => goTo("Questions")}>Continue to questions</Button>
            </div>
          </>
        ) : null}

        {step === "Questions" ? (
          <>
            <div className="rounded-xl border border-line p-4 space-y-2">
              <p className="font-semibold">Import from PDF or Word</p>
              <p className="text-sm text-ink-muted">Review the suggested questions and choose which rows to add.</p>
              <Input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => { const f = e.target.files?.[0]; if (f) void uploadImport(f); e.target.value = ""; }} />
            </div>
            <h2 className="text-xl font-bold">Questions ({draft.questions.length}/100)</h2>
            {incompleteCount > 0 ? (
              <p className="text-sm text-ink-muted">{readyCount} ready to save · {incompleteCount} incomplete (finish or remove before publishing).</p>
            ) : null}
            {draft.questions.map((q, i) => (
              <details key={`${i}-${q.prompt.slice(0, 20)}`} open={openQuestions[i]} onToggle={e => setOpenQuestions(o => ({ ...o, [i]: (e.target as HTMLDetailsElement).open }))} className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer font-bold">Question {i + 1}{q.prompt ? `: ${q.prompt.slice(0, 60)}${q.prompt.length > 60 ? "…" : ""}` : ""}</summary>
                <div className="mt-3 space-y-3">
                  <Button type="button" variant="secondary" size="sm" onClick={() => change({ questions: draft.questions.filter((_, n) => n !== i) })}>Remove question</Button>
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
                </div>
              </details>
            ))}
            <Button type="button" variant="secondary" disabled={draft.questions.length >= 100} onClick={() => { change({ questions: [...draft.questions, emptyQuestion()] }); setOpenQuestions(o => ({ ...o, [draft.questions.length]: true })); }}>Add question</Button>
            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("Schedule")}>Back</Button>
              <Button type="button" onClick={() => goTo("Review")}>Review</Button>
            </div>
          </>
        ) : null}

        {step === "Review" ? (
          <section className="space-y-4 rounded-card border border-line bg-surface-page p-4">
            <h2 className="text-lg font-bold">Summary</h2>
            <ul className="space-y-1 text-sm" aria-label="Publish checklist">
              <li className={scheduleIssue ? "text-danger" : "text-success"}>{scheduleIssue ? `Schedule: ${scheduleIssue}` : "Schedule: ready"}</li>
              <li className={readyCount < 1 ? "text-danger" : "text-success"}>{readyCount < 1 ? "Questions: add at least one complete question" : `Questions: ${readyCount} ready${incompleteCount ? ` (${incompleteCount} incomplete will not be saved)` : ""}`}</li>
              <li className="text-ink-muted">Feedback: {feedbackLabel}</li>
            </ul>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-muted">Title</dt><dd className="font-semibold">{draft.title || "—"}</dd></div>
              <div><dt className="text-ink-muted">Questions</dt><dd className="font-semibold">{readyCount} ready / {draft.questions.length} in editor</dd></div>
              <div><dt className="text-ink-muted">Timer</dt><dd className="font-semibold">{draft.duration_minutes} minutes</dd></div>
              <div><dt className="text-ink-muted">Attempts</dt><dd className="font-semibold">{draft.max_attempts ?? 1}</dd></div>
              <div className="sm:col-span-2"><dt className="text-ink-muted">Window</dt><dd className="font-semibold">{formatQuizWindow(draft.opens_at ?? null, draft.closes_at ?? null)}</dd></div>
            </dl>
            {scheduleWarning ? <p className="text-sm text-warning">{scheduleWarning}</p> : null}
            <p className="text-sm text-ink-muted">Publishing locks the questions and schedule. Students enrolled in the class shown above receive a notification. Options are shuffled per student.</p>
            <ReviewPreviewList questions={completeQuizQuestions(draft.questions)} />
            {publishIssue ? <p className="text-sm text-danger">{publishIssue}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("Questions")}>Back</Button>
              <Button type="submit" loading={busy}>Save draft</Button>
              <Button
                type="button"
                disabled={Boolean(publishIssue) || busy}
                onClick={() => {
                  if (window.confirm("Publish to students enrolled in this class? You cannot edit the questions afterwards.")) void save(true);
                }}
              >
                Publish quiz
              </Button>
            </div>
            {revision !== null ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy || !id}
                onClick={async () => {
                  if (!id || !window.confirm("Cancel this draft?")) return;
                  setBusy(true);
                  try {
                    await api().cancel(id);
                    setDirty(false);
                    router.push(`/lecturer/courses/${offering}/quizzes`);
                    router.refresh();
                  } catch (e) {
                    setError(e);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Cancel draft
              </Button>
            ) : null}
          </section>
        ) : null}
      </fieldset>

      <ImportReviewDialog
        key={importSession}
        open={Boolean(importReview)}
        questions={importReview ?? []}
        onClose={() => setImportReview(null)}
        onMerge={mergeImport}
      />
    </form>
  );
}

function ImportReviewDialog({ open, questions, onClose, onMerge }: {
  open: boolean;
  questions: LecturerQuizQuestion[];
  onClose: () => void;
  onMerge: (q: LecturerQuizQuestion[]) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(questions.map((_, i) => i)));
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogTitle>Review imported questions</DialogTitle>
        <DialogDescription>Select the rows to add to your quiz. Edit wording on the next screen.</DialogDescription>
        <ul className="space-y-3">{questions.map((q, i) => (
          <li key={i} className="rounded-lg border border-line p-3 text-sm">
            <label className="flex gap-2">
              <input type="checkbox" checked={selected.has(i)} onChange={e => setSelected(s => {
                const n = new Set(s);
                if (e.target.checked) n.add(i); else n.delete(i);
                return n;
              })} />
              <span className="min-w-0"><span className="font-semibold">Q{i + 1}.</span> <MathText text={q.prompt} /></span>
            </label>
          </li>
        ))}</ul>
        <DialogFooter className="gap-2">
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={() => onMerge(questions.filter((_, i) => selected.has(i)))}>Add {selected.size} question{selected.size === 1 ? "" : "s"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewPreviewList({ questions }: { questions: LecturerQuizQuestion[] }) {
  if (!questions.length) return <p className="text-sm text-ink-muted">Add at least one complete question before publishing.</p>;
  return <QuizQuestionReview questions={questions.slice(0, 3)} />;
}

export function QuizQuestionReview({ questions }: { questions: LecturerQuizQuestion[] }) {
  return <ol className="space-y-4">{questions.map((q, i) => (
    <li key={i} className="rounded-xl border border-line p-4 break-words"><p className="font-semibold"><MathText text={q.prompt} /></p>
      <ul className="mt-2 space-y-1">{q.options.map((o, n) => <li key={n} className={n === q.correct ? "font-semibold text-brand-primary" : ""}><MathText text={o} /></li>)}</ul>
      {q.explanation ? <p className="mt-2 text-sm text-ink-muted"><MathText text={q.explanation} /></p> : null}
    </li>
  ))}</ol>;
}
