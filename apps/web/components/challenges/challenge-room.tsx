"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ChallengeDetail } from "@scholau/core";
import { MathText } from "@/components/math/math-text";
import { Button } from "@/components/ui/button";
import { ChallengeEditor } from "./challenge-editor";
import { api, CourseRoster, Failure, QuestionReview, useChallengeClock } from "./course-challenges";
export function ChallengeRoom({ id }: { id: string }) {
  const [actionError, setActionError] = useState<unknown>(null), [busy, setBusy] = useState(false);
  const query = useQuery({ staleTime: 0, queryKey: ["challenge", id], queryFn: () => api().detail(id), refetchInterval: busy ? false : 10000 });
  async function act(action: () => Promise<unknown>) { setBusy(true); setActionError(null); try { await action(); await query.refetch(); } catch (e) { setActionError(e); } finally { setBusy(false); } }
  if (!query.data) return <><Failure error={query.error} retry={() => void query.refetch()} />{query.isPending && <p role="status">Loading challenge…</p>}</>;
  const d = query.data, c = d.challenge;
  if (d.teacher && c.state === "draft") return <ChallengeEditor key={c.id} offering={c.offering_id} initial={d} />;
  return <div className="space-y-6 min-w-0 break-words"><Link className="inline-flex min-h-11 items-center underline" href={`/courses/${c.offering_id}/challenges`}>Back to challenges</Link><h1 className="text-2xl font-bold">{c.title}</h1><p className="whitespace-pre-wrap">{c.instructions}</p><p className="capitalize">{c.state} · {c.question_count} questions · {c.duration_minutes} minutes</p><p>{c.starts_at && new Date(c.starts_at).toLocaleString()} – {c.ends_at && new Date(c.ends_at).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone})</p>
    <Failure error={actionError || query.error} retry={() => { setActionError(null); void query.refetch(); }} />
    {c.state === "cancelled" ? <p role="status">This challenge was cancelled. There is no ranking.</p> : <>
      {c.state === "upcoming" && <p role="status">The challenge will open automatically at the scheduled time.</p>}
      {d.teacher ? <>{(c.state === "upcoming" || c.state === "active") && <Button disabled={busy} variant="secondary" onClick={() => { if (window.confirm("Cancel this challenge for everyone? No ranking will be produced.")) void act(() => api().cancel(id)); }}>Cancel challenge</Button>}<CourseRoster offering={c.offering_id} challenge={id} /></> : <>
        {c.state === "active" && !d.attempt && <><p>One attempt. Ranking uses correct answers, then time from the common start. Late entry does not reset the timer. If your leaderboard identity is hidden, classmates see a participant alias; your lecturer still sees your name.</p><Button disabled={busy} onClick={() => void act(() => api().join(id))}>Join challenge</Button></>}
        {d.attempt && c.state === "active" && <ChallengeAttemptView key={id} detail={d} refresh={() => void query.refetch()} />}
        {c.state === "finished" && <>{d.attempt ? <QuestionReview detail={d} /> : <p>You did not participate.</p>}<CourseRoster offering={c.offering_id} challenge={id} teacher={false} /></>}
      </>}
    </>}
  </div>;
}
export function ChallengeAttemptView({ detail, refresh }: { detail: ChallengeDetail; refresh: () => void }) {
  const [attempt, setAttempt] = useState(detail.attempt!), [index, setIndex] = useState(0), [pending, setPending] = useState<{ question: number; option: number } | null>(null);
  const [error, setError] = useState<unknown>(null), [saving, setSaving] = useState(false), [submitting, setSubmitting] = useState(false);
  const active = useRef(false), mounted = useRef(true), seenEnd = useRef(false);
  const now = useChallengeClock(detail.server_time);
  const seconds = Math.max(0, Math.ceil((Date.parse(detail.challenge.ends_at!) - now) / 1000));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!active.current) setAttempt(current => detail.attempt!.revision >= current.revision ? detail.attempt! : current); }, [detail.attempt]);
  useEffect(() => { if (seconds === 0 && !seenEnd.current) { seenEnd.current = true; refresh(); } }, [seconds, refresh]);
  useEffect(() => { if (!pending) return; const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [pending]);
  async function save(choice: { question: number; option: number }) {
    if (active.current || !seconds) return;
    active.current = true; setPending(choice); setSaving(true); setError(null);
    try {
      const result = await api().answer(detail.challenge.id, choice.question, choice.option, attempt.revision);
      if (mounted.current) { setAttempt(result.attempt!); setPending(null); }
    } catch (e) { if (mounted.current) setError(e); }
    finally { active.current = false; if (mounted.current) setSaving(false); }
  }
  async function reload() {
    if (active.current) return;
    active.current = true; setSaving(true);
    try { const result = await api().detail(detail.challenge.id); setAttempt(result.attempt!); setPending(null); setError(null); refresh(); } catch (e) { setError(e); } finally { active.current = false; setSaving(false); }
  }
  async function submit() {
    if (active.current || pending || !window.confirm("Submit your answers? You cannot change them afterwards.")) return;
    active.current = true; setSubmitting(true); setError(null);
    try { const result = await api().submit(detail.challenge.id, attempt.revision); setAttempt(result.attempt!); refresh(); } catch (e) { setError(e); } finally { active.current = false; setSubmitting(false); }
  }
  if (attempt.submitted_at) return <p role="status">Answers submitted. Results and ranking will appear when the challenge closes.</p>;
  const q = detail.questions[index];
  if (!q) return null;
  const disabled = saving || submitting || !seconds;
  return <section className="space-y-4 min-w-0" aria-label="Challenge attempt"><p role="timer" aria-label="Time remaining">Time remaining: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p>
    <p role="status">{saving ? "Saving answer…" : pending ? "Answer not saved. Retry before the challenge closes." : "All changes saved."}</p>
    <Failure error={error} />{Boolean(error) && <div className="flex flex-wrap gap-2">{pending && seconds > 0 && <Button disabled={disabled} onClick={() => void save(pending)}>Retry saving answer</Button>}<Button disabled={disabled} variant="secondary" onClick={() => void reload()}>Reload saved answers</Button></div>}
    {!seconds && <p role="alert">Time is up. Only answers saved before closing count. Refresh to view results.</p>}
    <fieldset disabled={disabled || Boolean(pending && error)} className="space-y-3 min-w-0"><legend className="font-bold whitespace-pre-wrap">Question {index + 1} of {detail.questions.length}: <MathText text={q.prompt} /></legend>{q.options.map((option, n) => <label key={n} className="flex items-start gap-3 rounded-lg border border-line p-3 min-h-11 cursor-pointer"><input className="mt-1 shrink-0" type="radio" name={`question-${index}`} value={n} checked={(pending?.question === index ? pending.option : attempt.answers[String(index)]) === n} onChange={() => void save({ question: index, option: n })} /><span className="min-w-0 break-words"><MathText text={option} /></span></label>)}</fieldset>
    <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={!index || disabled || Boolean(pending)} onClick={() => setIndex(i => i - 1)}>Previous question</Button><Button variant="secondary" disabled={index === detail.questions.length - 1 || disabled || Boolean(pending)} onClick={() => setIndex(i => i + 1)}>Next question</Button></div>
    <p>{Object.keys(attempt.answers).length}/{detail.questions.length} answered</p><Button disabled={disabled || Boolean(pending)} loading={submitting} onClick={() => void submit()}>Submit answers</Button>
  </section>;
}
