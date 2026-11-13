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
import { GenerateQuestionsDialog } from "./generate-questions-dialog";
import { defaultQuizWindow, formatQuizWindow } from "./quiz-ui";
import { lecturerQuizApi, lecturerQuizError } from "@/lib/lecturer-quiz-api";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const api = () => lecturerQuizApi(getBrowserSupabase());
const subscribeZone = () => () => {};
const readZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const OPTION_LETTERS = "ABCDEF";

function localDateTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const emptyQuestion = (): LecturerQuizQuestion => ({ prompt: "", options: ["", "", "", ""], correct: 0, explanation: "" });
const steps: QuizEditorStep[] = ["Schedule", "Questions", "Review"];

const fieldLabel = "mb-1 block text-xs font-medium text-ink-muted";

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
  const [reviewTitle, setReviewTitle] = useState("Review imported questions");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);
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
        void queryClient.invalidateQueries({ queryKey: qk.courseQuiz(quizId) });
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
        setReviewTitle("Review imported questions");
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

  function addQuestion() {
    change({ questions: [...draft.questions, emptyQuestion()] });
    setOpenQuestions(o => ({ ...o, [draft.questions.length]: true }));
  }

  const publishIssue = publishBlockers(draft, true);
  const feedbackLabel = draft.feedback_mode === "immediate" ? "Score only (hide answer review)" : "Full answer review after submit";

  return (
    <form className="min-w-0 space-y-3" onSubmit={e => { e.preventDefault(); void save(false); }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Link
          className="inline-flex min-h-8 items-center text-sm font-medium text-brand-primary underline-offset-2 hover:underline"
          href={`/lecturer/courses/${offering}/quizzes`}
          onClick={e => { if (dirty && !window.confirm("Leave without saving your changes?")) e.preventDefault(); }}
        >
          Back to quizzes
        </Link>
        {message ? <p role="status" className="text-xs text-ink-muted">{message}</p> : null}
      </div>

      <h1 className="text-base font-semibold tracking-tight text-ink">{initial ? "Edit quiz" : "Create quiz"}</h1>

      <nav aria-label="Quiz editor steps" className="flex gap-0 border-b border-line">
        {steps.map((s, i) => {
          const locked = (s === "Questions" && !canOpenQuestions) || (s === "Review" && !canOpenReview);
          const active = step === s;
          return (
            <button
              key={s}
              type="button"
              disabled={locked}
              onClick={() => goTo(s)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary",
                active ? "border-brand-primary text-ink" : "border-transparent text-ink-muted hover:text-ink",
                locked && "cursor-not-allowed opacity-40 hover:text-ink-muted",
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

      <fieldset disabled={busy || importBusy || generateBusy} className="min-w-0 space-y-3">
        {step === "Schedule" ? (
          <div className="space-y-3">
            <label className="block">
              <span className={fieldLabel}>Title</span>
              <Input required maxLength={160} value={draft.title} onChange={e => change({ title: e.target.value })} className="min-h-10" />
            </label>
            <label className="block">
              <span className={fieldLabel}>Instructions</span>
              <Textarea
                aria-label="Instructions"
                maxLength={4000}
                value={draft.instructions}
                onChange={e => change({ instructions: e.target.value })}
                className="min-h-20 py-2"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={fieldLabel}>Duration (minutes)</span>
                <Input
                  type="number"
                  min={1}
                  max={180}
                  required
                  value={draft.duration_minutes}
                  onChange={e => change({ duration_minutes: Number(e.target.value) })}
                  className="min-h-10"
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Max attempts</span>
                <NativeSelect
                  aria-label="Max attempts"
                  value={draft.max_attempts ?? 1}
                  onChange={e => change({ max_attempts: Number(e.target.value) })}
                  className="min-h-10"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </NativeSelect>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={fieldLabel}>Opens</span>
                <Input
                  type="datetime-local"
                  required
                  className="min-h-10 min-w-0 max-w-full"
                  value={localDateTime(draft.opens_at)}
                  onChange={e => change({ opens_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Closes</span>
                <Input
                  type="datetime-local"
                  required
                  className="min-h-10 min-w-0 max-w-full"
                  value={localDateTime(draft.closes_at)}
                  onChange={e => change({ closes_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button type="button" variant="outline" size="sm" onClick={() => change(defaultQuizWindow())}>
                Use next 2-hour slot
              </Button>
              <p className="text-xs text-ink-muted">
                Start window · {draft.duration_minutes} min per attempt · {zone || "…"}
              </p>
            </div>
            {scheduleWarning ? (
              <p role="status" className="border border-warning bg-warning-bg px-2.5 py-1.5 text-xs text-warning">
                {scheduleWarning}
              </p>
            ) : null}
            <label className="block">
              <span className={fieldLabel}>Feedback after submit</span>
              <NativeSelect
                aria-label="Feedback after submit"
                value={draft.feedback_mode}
                onChange={e => change({ feedback_mode: e.target.value as "after_submit" | "immediate" })}
                className="min-h-10"
              >
                <option value="after_submit">Show correct answers and explanations</option>
                <option value="immediate">Score only — hide correct answers</option>
              </NativeSelect>
            </label>
            <div className="flex justify-end border-t border-line pt-3">
              <Button type="button" size="sm" onClick={() => goTo("Questions")}>Continue to questions</Button>
            </div>
          </div>
        ) : null}

        {step === "Questions" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 border border-line bg-surface-page px-2.5 py-2">
              <div className="mr-auto min-w-0">
                <h2 className="text-sm font-semibold text-ink">Questions ({draft.questions.length}/100)</h2>
                <p className="text-xs text-ink-muted">
                  {incompleteCount > 0
                    ? `${readyCount} ready · ${incompleteCount} incomplete`
                    : draft.questions.length
                      ? `${readyCount} ready`
                      : "Add manually, generate, or import"}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={importBusy || generateBusy || draft.questions.length >= 100}
                onClick={() => setGenerateOpen(true)}
                aria-label="Generate questions from course topics"
              >
                Generate questions
              </Button>
              <label className="inline-flex min-h-10 cursor-pointer items-center rounded-control border border-line bg-surface-card px-3 text-[13px] font-semibold text-ink hover:border-line-strong hover:bg-surface-page">
                Import PDF/Word
                <Input
                  type="file"
                  className="sr-only"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void uploadImport(f); e.target.value = ""; }}
                />
              </label>
              <Button type="button" variant="secondary" size="sm" disabled={draft.questions.length >= 100} onClick={addQuestion}>
                Add question
              </Button>
              {(importBusy || generateBusy) ? (
                <span role="status" className="basis-full text-xs text-ink-muted sm:basis-auto">
                  {generateBusy ? "Generating…" : "Importing…"}
                </span>
              ) : null}
            </div>

            <ul className="space-y-2">
              {draft.questions.map((q, i) => {
                const open = openQuestions[i] ?? false;
                const preview = q.prompt.trim() ? q.prompt.trim().slice(0, 72) + (q.prompt.trim().length > 72 ? "…" : "") : "Untitled question";
                return (
                  <li key={i} className="border border-line">
                    <div className="flex items-stretch gap-1 border-b border-line bg-surface-page">
                      <button
                        type="button"
                        className="flex min-h-10 min-w-0 flex-1 items-center gap-2 px-2.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary"
                        aria-expanded={open}
                        onClick={() => setOpenQuestions(o => ({ ...o, [i]: !open }))}
                      >
                        <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-ink-muted">{i + 1}</span>
                        <span className="min-w-0 truncate font-medium text-ink">{preview}</span>
                        <span className="ml-auto shrink-0 text-xs text-ink-muted" aria-hidden>{open ? "▾" : "▸"}</span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 rounded-none text-ink-muted hover:text-danger"
                        onClick={() => {
                          change({ questions: draft.questions.filter((_, n) => n !== i) });
                          setOpenQuestions(o => {
                            const next: Record<number, boolean> = {};
                            Object.entries(o).forEach(([key, value]) => {
                              const idx = Number(key);
                              if (idx < i) next[idx] = value;
                              else if (idx > i) next[idx - 1] = value;
                            });
                            return next;
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                    {open ? (
                      <div className="space-y-2.5 p-3">
                        <label className="block">
                          <span className={fieldLabel}>Question text</span>
                          <Textarea
                            required
                            maxLength={2000}
                            value={q.prompt}
                            onChange={e => question(i, { prompt: e.target.value })}
                            className="min-h-16 py-2"
                          />
                        </label>
                        <fieldset className="space-y-1.5">
                          <legend className={fieldLabel}>Options — select the correct answer</legend>
                          {q.options.map((option, n) => {
                            const letter = OPTION_LETTERS[n] ?? String(n + 1);
                            const isCorrect = (q.correct ?? 0) === n;
                            return (
                              <div
                                key={n}
                                className={cn(
                                  "flex items-center gap-2 border px-2 py-1.5",
                                  isCorrect ? "border-brand-primary bg-surface-tint" : "border-line",
                                )}
                              >
                                <button
                                  type="button"
                                  aria-label={`Mark option ${letter} as correct`}
                                  aria-pressed={isCorrect}
                                  onClick={() => question(i, { correct: n })}
                                  className={cn(
                                    "flex size-8 shrink-0 items-center justify-center rounded-control border text-xs font-semibold focus-visible:outline-2 focus-visible:outline-brand-primary",
                                    isCorrect
                                      ? "border-brand-primary bg-brand-primary text-white"
                                      : "border-line bg-surface-card text-ink-muted hover:border-line-strong",
                                  )}
                                >
                                  {letter}
                                </button>
                                <Input
                                  required
                                  maxLength={1000}
                                  aria-label={`Option ${n + 1}`}
                                  value={option}
                                  onChange={e => question(i, { options: q.options.map((o, k) => (k === n ? e.target.value : o)) })}
                                  className="min-h-9 border-0 bg-transparent px-1 shadow-none hover:border-0 focus-visible:border-0 focus-visible:outline-none"
                                />
                                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-ink-muted">
                                  <input
                                    type="radio"
                                    name={`correct-${i}`}
                                    checked={isCorrect}
                                    onChange={() => question(i, { correct: n })}
                                    className="size-3.5 accent-[var(--color-brand-primary)]"
                                  />
                                  <span className="sr-only sm:not-sr-only">Correct</span>
                                </label>
                              </div>
                            );
                          })}
                          <div className="flex flex-wrap gap-3 pt-0.5">
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              disabled={q.options.length >= 6}
                              onClick={() => question(i, { options: [...q.options, ""] })}
                            >
                              Add option
                            </Button>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              disabled={q.options.length <= 2}
                              onClick={() => question(i, {
                                options: q.options.slice(0, -1),
                                correct: Math.min(q.correct ?? 0, q.options.length - 2),
                              })}
                            >
                              Remove option
                            </Button>
                          </div>
                        </fieldset>
                        <label className="block">
                          <span className={fieldLabel}>Explanation (optional)</span>
                          <Textarea
                            maxLength={4000}
                            rows={2}
                            value={q.explanation ?? ""}
                            onChange={e => question(i, { explanation: e.target.value })}
                            className="min-h-12 py-2"
                          />
                        </label>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {!draft.questions.length ? (
              <p className="border border-dashed border-line px-3 py-6 text-center text-sm text-ink-muted">
                No questions yet. Add one, generate from topics, or import a file.
              </p>
            ) : null}

            <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setStep("Schedule")}>Back</Button>
              <Button type="button" size="sm" onClick={() => goTo("Review")}>Review</Button>
            </div>
          </div>
        ) : null}

        {step === "Review" ? (
          <section className="space-y-3 border border-line p-3">
            <h2 className="text-sm font-semibold text-ink">Summary</h2>
            <ul className="space-y-0.5 text-sm" aria-label="Publish checklist">
              <li className={scheduleIssue ? "text-danger" : "text-success"}>
                {scheduleIssue ? `Schedule: ${scheduleIssue}` : "Schedule: ready"}
              </li>
              <li className={readyCount < 1 ? "text-danger" : "text-success"}>
                {readyCount < 1
                  ? "Questions: add at least one complete question"
                  : `Questions: ${readyCount} ready${incompleteCount ? ` (${incompleteCount} incomplete will not be saved)` : ""}`}
              </li>
              <li className="text-ink-muted">Feedback: {feedbackLabel}</li>
            </ul>
            <dl className="grid gap-x-4 gap-y-1.5 border-t border-line pt-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-muted">Title</dt>
                <dd className="font-medium">{draft.title || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Questions</dt>
                <dd className="font-medium">{readyCount} ready / {draft.questions.length} in editor</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Timer</dt>
                <dd className="font-medium">{draft.duration_minutes} minutes</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Attempts</dt>
                <dd className="font-medium">{draft.max_attempts ?? 1}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-ink-muted">Window</dt>
                <dd className="font-medium">{formatQuizWindow(draft.opens_at ?? null, draft.closes_at ?? null)}</dd>
              </div>
            </dl>
            {scheduleWarning ? <p className="text-xs text-warning">{scheduleWarning}</p> : null}
            <p className="text-xs text-ink-muted">
              Publishing locks questions and schedule. Enrolled students are notified. Options shuffle per student.
            </p>
            <ReviewPreviewList questions={completeQuizQuestions(draft.questions)} />
            {publishIssue ? <p className="text-sm text-danger">{publishIssue}</p> : null}
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setStep("Questions")}>Back</Button>
              <div className="ml-auto flex flex-wrap gap-2">
                {revision !== null ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
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
                <Button type="submit" size="sm" loading={busy}>Save draft</Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={Boolean(publishIssue) || busy}
                  onClick={() => {
                    if (window.confirm("Publish to students enrolled in this class? You cannot edit the questions afterwards.")) void save(true);
                  }}
                >
                  Publish quiz
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </fieldset>

      <ImportReviewDialog
        key={importSession}
        open={Boolean(importReview)}
        title={reviewTitle}
        questions={importReview ?? []}
        onClose={() => setImportReview(null)}
        onMerge={mergeImport}
      />
      <GenerateQuestionsDialog
        open={generateOpen}
        offeringId={offering}
        quizId={id}
        currentQuestionCount={draft.questions.length}
        busy={generateBusy}
        onOpenChange={setGenerateOpen}
        onBusyChange={setGenerateBusy}
        onError={setError}
        onGenerated={(questions) => {
          setReviewTitle("Review generated questions");
          setImportSession((session) => session + 1);
          setImportReview(questions);
          goTo("Questions");
        }}
      />
    </form>
  );
}

function ImportReviewDialog({ open, title, questions, onClose, onMerge }: {
  open: boolean;
  title: string;
  questions: LecturerQuizQuestion[];
  onClose: () => void;
  onMerge: (q: LecturerQuizQuestion[]) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(questions.map((_, i) => i)));
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Select the rows to add to your quiz. Edit wording on the next screen.</DialogDescription>
        <ul className="space-y-1.5">
          {questions.map((q, i) => (
            <li key={i} className="border border-line px-2.5 py-2 text-sm">
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 shrink-0 accent-[var(--color-brand-primary)]"
                  checked={selected.has(i)}
                  onChange={e => setSelected(s => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(i); else n.delete(i);
                    return n;
                  })}
                />
                <span className="min-w-0">
                  <span className="font-medium">Q{i + 1}.</span> <MathText text={q.prompt} />
                </span>
              </label>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2">
          <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
          <Button size="sm" onClick={() => onMerge(questions.filter((_, i) => selected.has(i)))}>
            Add {selected.size} question{selected.size === 1 ? "" : "s"}
          </Button>
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
  return (
    <ol className="space-y-2">
      {questions.map((q, i) => (
        <li key={i} className="break-words border border-line p-2.5 text-sm">
          <p className="font-medium"><MathText text={q.prompt} /></p>
          <ul className="mt-1.5 space-y-0.5">
            {q.options.map((o, n) => (
              <li
                key={n}
                className={cn(
                  "flex gap-2",
                  n === q.correct ? "font-medium text-brand-primary" : "text-ink",
                )}
              >
                <span className="w-4 shrink-0 text-xs text-ink-muted">{OPTION_LETTERS[n] ?? n + 1}.</span>
                <MathText text={o} />
              </li>
            ))}
          </ul>
          {q.explanation ? (
            <p className="mt-1.5 text-xs text-ink-muted"><MathText text={q.explanation} /></p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
