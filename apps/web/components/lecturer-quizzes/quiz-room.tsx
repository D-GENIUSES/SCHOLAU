"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isApiError } from "@scholau/api";
import type { LecturerQuizDetail } from "@scholau/api";
import { useCourseQuiz } from "@scholau/api/react";
import type { LecturerQuizAttempt } from "@scholau/core";
import { canonicalAnswerToDisplayIndex, isNestedOptionOrdersForQuestions } from "@scholau/core";
import { MathText } from "@/components/math/math-text";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
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
  if (!order || !perm) {
    const answer = attempt.answers[String(displayIndex)];
    return typeof answer === "number" ? answer : undefined;
  }
  const cq = Number(order[displayIndex]);
  const canonical = attempt.answers[String(cq)] ?? attempt.answers[cq];
  if (typeof canonical !== "number") return undefined;
  return canonicalAnswerToDisplayIndex(perm, Number(canonical));
}

function displayResponse(attempt: LecturerQuizAttempt, displayIndex: number): string {
  const canonicalIndex = attempt.question_order?.[displayIndex] ?? displayIndex;
  const value = attempt.answers[String(canonicalIndex)] ?? attempt.answers[canonicalIndex];
  return typeof value === "string" ? value : typeof value === "object" && value ? value.response : "";
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

function beginSpeechInput(onText: (text: string) => void, onEnd: () => void): SpeechRecognitionLike | null {
  const speechWindow = window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.lang = navigator.language || "en-NG";
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
    if (transcript) onText(transcript);
  };
  recognition.onend = onEnd;
  recognition.onerror = onEnd;
  recognition.start();
  return recognition;
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
  if (d.teacher && q.state === "draft") return <QuizEditor offering={q.offering_id} initial={d} classroomId={q.classroom_id} />;
  const studentPreview = Boolean(d.teacher && preview);
  const asStudent = !d.teacher || studentPreview;
  const windowLine = formatQuizWindow(q.opens_at, q.closes_at);
  const instructions = q.instructions?.trim() || "Follow your lecturer’s directions for this class quiz.";
  const attemptInProgress = Boolean(d.attempt && !d.attempt.submitted_at && d.questions.length);
  return (
    <div className="space-y-4 min-w-0 break-words">
      <Link className="inline-flex min-h-9 items-center text-sm font-semibold text-brand-primary underline-offset-2 hover:underline" href={q.classroom_id ? `${d.teacher ? "/lecturer" : ""}/classrooms/${q.classroom_id}` : d.teacher ? `/lecturer/courses/${q.offering_id}/quizzes` : `/study/courses/${d.viewer_offering_id ?? q.offering_id}/assessments?tab=class-quizzes`}>{q.classroom_id ? "Back to classroom" : "Back to quizzes"}</Link>
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
          {q.state !== "draft" ? (
            <ExtendQuizClose quiz={q} busy={busy} act={act} />
          ) : null}
          {q.state !== "closed" && q.state !== "draft" ? (
            <Button disabled={busy} variant="outline" size="sm" onClick={() => { if (window.confirm("Cancel this quiz?")) void act(() => quizApi().cancel(id)); }}>Cancel quiz</Button>
          ) : null}
          <QuizRoster offering={q.offering_id} quizId={id} />
          {d.questions.some((question) => question.type === "written" || question.type === "oral") ? <WrittenResponseReview quizId={id} /> : null}
          {d.questions.length ? <QuizQuestionReview questions={d.questions} /> : null}
        </>
      )}
    </div>
  );
}

function ExtendQuizClose({
  quiz,
  busy,
  act,
}: {
  quiz: LecturerQuizDetail["quiz"];
  busy: boolean;
  act: (fn: () => Promise<unknown>) => void;
}) {
  const [closesAt, setClosesAt] = useState(() => {
    if (!quiz.closes_at) return "";
    const date = new Date(quiz.closes_at);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  return (
    <section className="flex flex-wrap items-end gap-2 rounded-card border border-line p-3">
      <label className="block flex-1 min-w-48 text-sm">
        Extend close time
        <Input
          type="datetime-local"
          value={closesAt}
          disabled={busy}
          onChange={(event) => setClosesAt(event.target.value)}
        />
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || !closesAt}
        onClick={() => {
          const iso = new Date(closesAt).toISOString();
          void act(() => quizApi().extend(quiz.id, quiz.revision, iso));
        }}
      >
        Extend quiz
      </Button>
    </section>
  );
}

function QuizIntake({
  detail,
  onStart,
  busy,
  preview = false,
}: {
  detail: LecturerQuizDetail;
  onStart: (matric: string, displayName: string) => void;
  busy: boolean;
  preview?: boolean;
}) {
  const [matric, setMatric] = useState(detail.profile?.matric_number ?? "");
  const [displayName, setDisplayName] = useState(detail.profile?.display_name ?? "");
  const q = detail.quiz;
  return (
    <section className="space-y-4 rounded-xl border border-line p-4">
      <h2 className="text-lg font-bold">Confirm your details</h2>
      <p className="text-xs text-ink-muted" role="status">
        {detail.attempts_used}/{q.max_attempts} attempts · keep the quiz in focus
      </p>
      <label className="block text-sm">Display name
        <Input
          required
          minLength={2}
          maxLength={60}
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          autoComplete="name"
          disabled={preview}
          placeholder={preview ? "Student display name" : "Enter your display name"}
        />
      </label>
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
      <Button disabled={preview || busy || matric.trim().length < 3 || displayName.trim().length < 2} onClick={() => onStart(matric.trim(), displayName.trim())}>
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
    return <QuizIntake detail={detail} busy={busy} onStart={(matric, displayName) => void act(() => quizApi().start(detail.quiz.id, matric, displayName))} />;
  }
  if (detail.attempt && !detail.attempt.submitted_at && detail.questions.length) {
    const badShuffle = !isNestedOptionOrdersForQuestions(detail.attempt.option_orders, detail.questions.map((question) => question.type === "mcq" || !question.type ? question.options?.length ?? 0 : 0));
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
  const manualQuestions = detail.questions.filter((question) => question.type === "written" || question.type === "oral");
  const manualPending = detail.questions.some((question, displayIndex) => {
    if (question.type !== "written" && question.type !== "oral") return false;
    const canonical = a.question_order?.[displayIndex] ?? displayIndex;
    const response = a.answers[String(canonical)];
    return typeof response !== "object" || response === null || response.score === undefined;
  });
  const autoQuestionCount = detail.questions.filter((question) => !["written", "oral"].includes(question.type ?? "mcq")).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your result</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p role="status" className="text-lg font-semibold">
          {manualQuestions.length ? `Auto-score: ${a.score ?? 0} / ${autoQuestionCount}` : `Score: ${a.score ?? 0} / ${detail.quiz.question_count}`}
        </p>
        {manualQuestions.length ? <p className="text-sm text-ink-muted">Written and oral responses are reviewed by your lecturer{manualPending ? "; your final score is pending." : "."}</p> : null}
        {review ? <QuizQuestionReview questions={detail.questions} /> : (
          <p className="text-sm text-ink-muted">Your lecturer chose not to show per-question review for this quiz.</p>
        )}
      </CardContent>
    </Card>
  );
}

type WrittenResponseRow = {
  attempt_id: string;
  student_name: string;
  matric_number: string;
  question_index: number;
  question_type: "written" | "oral";
  prompt: string;
  expected_answer: string;
  response: string;
  score: 0 | 1 | null;
  feedback: string | null;
};

function WrittenResponseReview({ quizId }: { quizId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<WrittenResponseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    try {
      const result = await quizApi().writtenResponses(quizId);
      setItems(result.items);
      setOpen(true);
      setMessage(null);
    } catch (error) {
      setMessage(lecturerQuizError(error));
    } finally { setLoading(false); }
  }
  async function grade(item: WrittenResponseRow, score: 0 | 1) {
    const key = `${item.attempt_id}:${item.question_index}`;
    setSavingKey(key); setMessage(null);
    try {
      await quizApi().gradeWrittenResponse(quizId, item.attempt_id, item.question_index, score, feedback[key] ?? item.feedback ?? "");
      setItems((current) => current.map((row) => row.attempt_id === item.attempt_id && row.question_index === item.question_index ? { ...row, score, feedback: feedback[key] ?? row.feedback } : row));
    } catch (error) { setMessage(lecturerQuizError(error)); }
    finally { setSavingKey(null); }
  }
  return <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-2">
      <CardTitle className="text-base">Written and oral responses</CardTitle>
      <Button size="sm" variant="outline" onClick={() => open ? setOpen(false) : void load()} loading={loading}>{open ? "Hide responses" : "Review responses"}</Button>
    </CardHeader>
    {open ? <CardContent className="space-y-3">
      {message ? <p role="alert" className="text-sm text-danger">{message}</p> : null}
      {!items.length && !loading ? <p className="text-sm text-ink-muted">No submitted written or oral responses yet.</p> : null}
      {items.map((item) => {
        const key = `${item.attempt_id}:${item.question_index}`;
        return <article key={key} className="space-y-2 rounded-control border border-line p-3">
          <p className="text-xs font-semibold text-ink-muted">{item.student_name} · {item.matric_number} · Question {item.question_index + 1} · {item.question_type === "oral" ? "Oral" : "Written"}</p>
          <p className="text-sm font-medium"><MathText text={item.prompt} /></p>
          <p className="whitespace-pre-wrap rounded-control bg-surface-page p-2 text-sm">{item.response || "No response"}</p>
          <p className="text-xs text-ink-muted">Model answer: {item.expected_answer}</p>
          <Textarea maxLength={2000} value={feedback[key] ?? item.feedback ?? ""} onChange={(event) => setFeedback((current) => ({ ...current, [key]: event.target.value }))} placeholder="Feedback for the student (optional)" aria-label="Feedback for student" />
          <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant={item.score === 1 ? "primary" : "outline"} disabled={savingKey === key} onClick={() => void grade(item, 1)}>Award 1 point</Button><Button size="sm" variant={item.score === 0 ? "primary" : "outline"} disabled={savingKey === key} onClick={() => void grade(item, 0)}>Award 0 points</Button>{item.score !== null ? <span className="text-xs text-ink-muted">Graded · {item.score}/1</span> : null}</div>
        </article>;
      })}
    </CardContent> : null}
  </Card>;
}

export function QuizAttemptView({ detail, refresh }: { detail: LecturerQuizDetail; refresh: () => void }) {
  const [attempt, setAttempt] = useState(detail.attempt!);
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<{ question: number; option: number } | null>(null);
  const [responseDraft, setResponseDraft] = useState("");
  const [dictating, setDictating] = useState(false);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);
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
  useEffect(() => { setResponseDraft(displayResponse(attempt, index)); }, [attempt, index]);
  useEffect(() => () => speechRecognition.current?.stop(), []);
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
  async function saveResponse() {
    if (active.current || !seconds) return;
    active.current = true; setSaving(true); setError(null);
    try {
      const result = await quizApi().answerWritten(detail.quiz.id, index, responseDraft, attempt.revision);
      if (mounted.current) setAttempt(result.attempt!);
    } catch (e) { if (mounted.current) setError(e); }
    finally { active.current = false; if (mounted.current) setSaving(false); }
  }
  function toggleDictation() {
    if (speechRecognition.current) { speechRecognition.current.stop(); speechRecognition.current = null; setDictating(false); return; }
    const recognition = beginSpeechInput((text) => setResponseDraft((current) => `${current}${current.trim() ? " " : ""}${text}`), () => { speechRecognition.current = null; setDictating(false); });
    if (!recognition) { setError(new Error("Voice input is not available in this browser. You can type your answer instead.")); return; }
    speechRecognition.current = recognition;
    setDictating(true);
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
  const answered = detail.questions.reduce((n, question, i) => {
    const answeredHere = ["written", "fill_blank", "oral"].includes(question.type ?? "mcq")
      ? displayResponse(attempt, i).trim().length > 0
      : displaySelection(attempt, i) !== undefined;
    return n + (answeredHere ? 1 : 0);
  }, 0);
  const questionType = qu.type ?? "mcq";
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
        {questionType === "mcq" ? (qu.options ?? []).map((option, n) => (
          <label key={n} className="flex items-start gap-3 rounded-lg border border-line p-3 min-h-11 cursor-pointer">
            <input className="mt-1" type="radio" name={`q-${index}`} checked={displaySelection(attempt, index) === n} onChange={() => void save({ question: index, option: n })} />
            <span className="min-w-0 break-words"><MathText text={option} /></span>
          </label>
        )) : <div className="space-y-2">
          <textarea className="min-h-32 w-full rounded-control border border-line bg-surface-card p-3 text-base focus-visible:outline-2 focus-visible:outline-brand-primary" maxLength={12000} value={responseDraft} onChange={(event) => setResponseDraft(event.target.value)} placeholder={questionType === "fill_blank" ? "Type the missing answer" : "Write your response"} aria-label="Your response" />
          {questionType === "oral" ? <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={toggleDictation}>{dictating ? "Stop speaking" : "Speak answer"}</Button><span className="text-xs text-ink-muted">You can type or use voice input; spoken words are transcribed into this answer.</span></div> : null}
          <Button type="button" variant="secondary" size="sm" disabled={disabled || responseDraft.length > 12000} loading={saving} onClick={() => void saveResponse()}>Save answer</Button>
        </div>}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={!index || disabled} onClick={() => setIndex(i => i - 1)}>Previous</Button>
        <Button variant="secondary" disabled={index === detail.questions.length - 1 || disabled} onClick={() => setIndex(i => i + 1)}>Next</Button>
      </div>
      <p className="text-xs text-ink-muted">{answered}/{detail.questions.length} answered</p>
      <Button disabled={disabled || Boolean(pending) || (questionType !== "mcq" && responseDraft !== displayResponse(attempt, index))} loading={submitting} onClick={() => void submit()}>Submit</Button>
    </section>
  );
}
