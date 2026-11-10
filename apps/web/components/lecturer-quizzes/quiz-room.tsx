"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isApiError } from "@scholau/api";
import type { LecturerQuizDetail } from "@scholau/api";
import { useCourseQuiz } from "@scholau/api/react";
import type { LecturerQuizAttempt } from "@scholau/core";
import { canonicalAnswerToDisplayIndex, isNestedOptionOrders } from "@scholau/core";
import { MathText } from "@/components/math/math-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Failure, useChallengeClock } from "@/components/challenges/course-challenges";
import { QuizIntegrityGuard, formatQuizFlagLabel } from "./quiz-integrity-guard";
import { QuizQuestionReview } from "./quiz-editor";
import { QuizRoster, quizApi } from "./course-quizzes";
import { QuizStateBadge, QuizStudentStatus, formatQuizWindow } from "./quiz-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { lecturerQuizError } from "@/lib/lecturer-quiz-api";

const QuizEditor = dynamic(() => import("./quiz-editor").then((m) => ({ default: m.QuizEditor })), {
  loading: () => <p className="text-sm text-ink-muted" role="status">Loading editor…</p>,
});

function displaySelection(attempt: LecturerQuizAttempt, displayIndex: number): number | undefined {
  const order = attempt.question_order;
  const perm = attempt.option_orders?.[displayIndex];
  if (!order || !perm) return attempt.answers[String(displayIndex)];
  const cq = Number(order[displayIndex]);
  const canonical = attempt.answers[String(cq)] ?? attempt.answers[cq];
  if (canonical === undefined) return undefined;
  return canonicalAnswerToDisplayIndex(perm, Number(canonical));
}

export function QuizRoom({ id, initialDetail }: { id: string; initialDetail?: LecturerQuizDetail }) {
  const searchParams = useSearchParams();
  const preview = searchParams.get("preview") === "1";
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const query = useCourseQuiz(id, initialDetail);
  async function act(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setActionError(null);
    try { await action(); await query.refetch(); } catch (e) { setActionError(e); } finally { setBusy(false); }
  }
  if (isApiError(query.error, "FORBIDDEN") || isApiError(query.error, "NOT_ENROLLED")) {
    return (
      <div className="space-y-3 rounded-card border border-line p-4">
        <h1 className="text-xl font-bold">Quiz unavailable for your account</h1>
        <p className="text-sm text-ink-muted">When a lecturer publishes a quiz, it becomes available to students enrolled in that class.</p>
        <Button asChild variant="outline"><Link href={preview ? "/lecturer" : "/home"}>Back</Link></Button>
      </div>
    );
  }
  if (!query.data) return <><Failure error={query.error} retry={() => void query.refetch()} />{query.isPending && <p role="status">Loading quiz…</p>}</>;
  const d = query.data;
  const q = d.quiz;
  if (d.teacher && q.state === "draft") return <QuizEditor offering={q.offering_id} initial={d} />;
  const studentPreview = Boolean(d.teacher && preview);
  const asStudent = !d.teacher || studentPreview;
  const windowLine = formatQuizWindow(q.opens_at, q.closes_at);
  const instructions = q.instructions?.trim() || "Follow your lecturer’s directions for this class quiz.";
  const attemptInProgress = Boolean(d.attempt && !d.attempt.submitted_at && d.questions.length);
  return (
    <div className="space-y-4 min-w-0 break-words">
      <Link className="inline-flex min-h-9 items-center text-sm font-semibold text-brand-primary underline-offset-2 hover:underline" href={d.teacher ? `/lecturer/courses/${q.offering_id}/quizzes` : `/study/courses/${d.viewer_offering_id ?? q.offering_id}/assessments?tab=class-quizzes`}>Back to quizzes</Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold tracking-tight sm:text-xl">{q.title}</h1>
        <QuizStateBadge state={q.state} />
        {studentPreview ? <span className="rounded-control border border-line px-2 py-0.5 text-[11px] font-medium text-ink-muted">Student preview</span> : null}
      </div>
      {asStudent ? (
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="whitespace-pre-wrap text-sm">{instructions}</p>
            <p className="text-xs text-ink-muted">{windowLine}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-ink-muted">{windowLine}</p>
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-xs font-medium text-ink-muted hover:text-ink">Instructions</summary>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-muted">{instructions}</p>
          </details>
        </div>
      )}
      <Failure error={actionError ? new Error(lecturerQuizError(actionError)) : query.error} retry={() => { setActionError(null); void query.refetch(); }} />
      {q.state === "cancelled" ? <p>This quiz was cancelled.</p> : asStudent ? (
        <>
          {studentPreview ? (
            <p className="text-xs text-ink-muted" role="status">Preview only — students start and submit from this screen. Live results stay in your lecturer workspace.</p>
          ) : null}
          <QuizStudentStatus
            state={q.state}
            opensAt={q.opens_at}
            closesAt={q.closes_at}
            questionCount={q.question_count}
            durationMinutes={q.duration_minutes}
            maxAttempts={q.max_attempts}
            attemptsUsed={d.attempts_used}
            submitted={Boolean(d.attempt?.submitted_at)}
            attemptInProgress={attemptInProgress}
          />
          {(q.state === "open" || d.attempt) && (
            <StudentQuizFlow
              detail={d}
              refresh={() => void query.refetch()}
              busy={busy}
              act={act}
              preview={studentPreview}
            />
          )}
          {!studentPreview && d.attempt?.submitted_at ? <QuizResults detail={d} /> : null}
        </>
      ) : (
        <>
          {q.state !== "closed" && q.state !== "draft" ? (
            <Button disabled={busy} variant="outline" size="sm" onClick={() => { if (window.confirm("Cancel this quiz?")) void act(() => quizApi().cancel(id)); }}>Cancel quiz</Button>
          ) : null}
          <QuizRoster offering={q.offering_id} quizId={id} />
          {d.questions.length ? <QuizQuestionReview questions={d.questions} /> : null}
        </>
      )}
    </div>
  );
}

function QuizIntake({
  detail,
  onStart,
  busy,
  preview = false,
}: {
  detail: LecturerQuizDetail;
  onStart: (matric: string) => void;
  busy: boolean;
  preview?: boolean;
}) {
  const [matric, setMatric] = useState(detail.profile?.matric_number ?? "");
  const q = detail.quiz;
  return (
    <section className="space-y-4 rounded-xl border border-line p-4">
      <h2 className="text-lg font-bold">Confirm your details</h2>
      <p className="text-xs text-ink-muted" role="status">
        {detail.attempts_used}/{q.max_attempts} attempts · keep the quiz in focus
      </p>
      <label className="block text-sm">Full name<p className="mt-1 font-medium">{detail.profile?.display_name || (preview ? "Student name" : "")}</p></label>
      <label className="block text-sm">Department<p className="mt-1 font-medium">{detail.profile?.department ?? (preview ? "Student department" : "Not set")}</p></label>
      <label className="block">Matriculation number
        <Input
          required
          value={matric}
          onChange={e => setMatric(e.target.value)}
          autoComplete="off"
          disabled={preview}
          placeholder={preview ? "Student matriculation number" : undefined}
        />
      </label>
      <Button disabled={preview || busy || !matric.trim()} onClick={() => onStart(matric.trim())}>
        {preview ? "Start quiz (students only)" : "Start quiz"}
      </Button>
    </section>
  );
}

function StudentQuizFlow({
  detail,
  refresh,
  busy,
  act,
  preview = false,
}: {
  detail: LecturerQuizDetail;
  refresh: () => void;
  busy: boolean;
  act: (fn: () => Promise<unknown>) => void;
  preview?: boolean;
}) {
  const q = detail.quiz;
  if (preview) {
    return <QuizIntake detail={detail} busy={busy} preview onStart={() => undefined} />;
  }
  if (q.state === "open" && !detail.attempt) {
    const used = detail.attempts_used >= q.max_attempts;
    if (used) return <p className="text-sm">You have used all {q.max_attempts} attempt(s).</p>;
    return <QuizIntake detail={detail} busy={busy} onStart={matric => void act(() => quizApi().start(detail.quiz.id, matric))} />;
  }
  if (detail.attempt && !detail.attempt.submitted_at && detail.questions.length) {
    const badShuffle = !isNestedOptionOrders(detail.attempt.option_orders, detail.questions.length);
    if (badShuffle) {
      return (
        <p role="alert" className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
          This attempt was started before a server fix and cannot save answers safely. Start a new attempt (if allowed) or ask your lecturer to republish the quiz.
        </p>
      );
    }
    return <QuizAttemptView key={detail.attempt.id} detail={detail} refresh={refresh} />;
  }
  return null;
}

function QuizResults({ detail }: { detail: LecturerQuizDetail }) {
  const a = detail.attempt!;
  const review = detail.questions.some((x) => x.correct != null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your result</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p role="status" className="text-lg font-semibold">
          Score: {a.score ?? 0} / {detail.quiz.question_count}
        </p>
        {review ? <QuizQuestionReview questions={detail.questions} /> : (
          <p className="text-sm text-ink-muted">Your lecturer chose not to show per-question review for this quiz.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function QuizAttemptView({ detail, refresh }: { detail: LecturerQuizDetail; refresh: () => void }) {
  const [attempt, setAttempt] = useState(detail.attempt!);
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<{ question: number; option: number } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flags, setFlags] = useState(0);
  const [flagPending, setFlagPending] = useState(false);
  const active = useRef(false);
  const mounted = useRef(true);
  const seenEnd = useRef(false);
  const now = useChallengeClock(detail.server_time);
  const seconds = Math.max(0, Math.ceil((Date.parse(attempt.expires_at) - now) / 1000));
  const onFlagsChange = useCallback((nextFlags: number, pendingUpload: boolean) => {
    setFlags(nextFlags);
    setFlagPending(pendingUpload);
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!active.current) setAttempt(c => detail.attempt!.revision >= c.revision ? detail.attempt! : c); }, [detail.attempt]);
  useEffect(() => { if (seconds === 0 && !seenEnd.current) { seenEnd.current = true; refresh(); } }, [seconds, refresh]);
  async function save(choice: { question: number; option: number }) {
    if (active.current || !seconds) return;
    active.current = true; setPending(choice); setSaving(true); setError(null);
    try {
      const result = await quizApi().answer(detail.quiz.id, choice.question, choice.option, attempt.revision);
      if (mounted.current) { setAttempt(result.attempt!); setPending(null); }
    } catch (e) { if (mounted.current) setError(e); }
    finally { active.current = false; if (mounted.current) setSaving(false); }
  }
  async function submit() {
    if (active.current || pending || !window.confirm("Submit your answers?")) return;
    active.current = true; setSubmitting(true);
    try { await quizApi().submit(detail.quiz.id, attempt.revision); refresh(); } catch (e) { setError(e); } finally { active.current = false; setSubmitting(false); }
  }
  if (attempt.submitted_at) return <QuizResults detail={{ ...detail, attempt }} />;
  const qu = detail.questions[index];
  if (!qu) return null;
  const disabled = saving || submitting || !seconds;
  const answered = detail.questions.reduce((n, _, i) => (displaySelection(attempt, i) !== undefined ? n + 1 : n), 0);
  const flagLabel = formatQuizFlagLabel(flags, flagPending);
  return (
    <section className="space-y-4 min-w-0" aria-label="Quiz attempt">
      <QuizIntegrityGuard attemptId={attempt.id} active={seconds > 0} onFlagsChange={onFlagsChange} />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-ink-muted" role="status">
        <p role="timer" className="font-medium text-ink">
          Time remaining: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </p>
        <p>
          Attempt {attempt.attempt_number}/{detail.quiz.max_attempts}
          {flagLabel ? <> · <span className="text-warning">{flagLabel}</span></> : null}
        </p>
      </div>
      <Failure error={error ? new Error(lecturerQuizError(error)) : null} />
      {!seconds && <p role="alert">Time is up. Refresh to see your result.</p>}
      <fieldset disabled={disabled} className="space-y-3">
        <legend className="font-bold">Question {index + 1} of {detail.questions.length}: <MathText text={qu.prompt} /></legend>
        {qu.options.map((option, n) => (
          <label key={n} className="flex items-start gap-3 rounded-lg border border-line p-3 min-h-11 cursor-pointer">
            <input className="mt-1" type="radio" name={`q-${index}`} checked={displaySelection(attempt, index) === n} onChange={() => void save({ question: index, option: n })} />
            <span className="min-w-0 break-words"><MathText text={option} /></span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={!index || disabled} onClick={() => setIndex(i => i - 1)}>Previous</Button>
        <Button variant="secondary" disabled={index === detail.questions.length - 1 || disabled} onClick={() => setIndex(i => i + 1)}>Next</Button>
      </div>
      <p className="text-xs text-ink-muted">{answered}/{detail.questions.length} answered</p>
      <Button disabled={disabled || Boolean(pending)} loading={submitting} onClick={() => void submit()}>Submit</Button>
    </section>
  );
}
