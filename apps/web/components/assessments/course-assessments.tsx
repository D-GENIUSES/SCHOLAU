"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList, Coffee, ListChecks, Timer, Trophy } from "lucide-react";
import { CourseQuizzes } from "@/components/lecturer-quizzes/course-quizzes";
import { type CourseAssessment, type CourseOverview, isApiError } from "@scholau/api";
import { useStartAttempt, useStartTopicQuiz, useTopicQuizOptions } from "@scholau/api/react";
import { ASSESSMENT_XP_COPY, formatDuration, pluralize } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { ErrorState, InlineError } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/dialog";
import { api as challengeApi, Failure, Paging } from "@/components/challenges/course-challenges";
import { useAnalytics } from "@/lib/analytics";

const tabs = [
  { id: "quiz", label: "Topic quiz", icon: ListChecks },
  { id: "mock", label: "Mock exam", icon: Timer },
  { id: "challenges", label: "Challenges", icon: Trophy },
  { id: "class-quizzes", label: "Class quizzes", icon: ClipboardList },
] as const;

export function CourseAssessments({ data, initialTab = "quiz" }: { data: CourseOverview; initialTab?: (typeof tabs)[number]["id"] }) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>(initialTab);
  return (
    <>
      <header className="mb-5">
        <p className="text-xs font-semibold text-brand-primary">{data.course.code} · {data.course.title}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Assessments</h1>
        <p className="mt-1 text-sm text-ink-muted">Choose how you want to practise.</p>
      </header>
      <div role="tablist" aria-label="Assessment type" className="mb-4 grid grid-cols-2 sm:grid-cols-4 border-b border-line">
        {tabs.map(({ id, label, icon: Icon }, index) => (
          <button key={id} type="button" role="tab" id={`assessment-tab-${id}`} aria-controls={`assessment-panel-${id}`} aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            onKeyDown={event => {
              const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
              if (next === null) return;
              event.preventDefault();
              const target = tabs[next];
              if (!target) return;
              setTab(target.id);
              document.getElementById(`assessment-tab-${target.id}`)?.focus();
            }}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 border-b-2 px-1 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-brand-primary sm:gap-2 sm:text-sm ${tab === id ? "border-brand-primary text-brand-primary" : "border-transparent text-ink-muted hover:text-ink"}`}>
            <Icon className="size-4 shrink-0" aria-hidden />{label}
          </button>
        ))}
      </div>
      {tabs.map(({ id }) => (
        <section key={id} role="tabpanel" id={`assessment-panel-${id}`} aria-labelledby={`assessment-tab-${id}`} hidden={tab !== id}
          className="min-w-0 rounded-card border border-line bg-surface-card p-4 sm:p-5">
          {id === "quiz" ? <TopicQuiz data={data} /> : id === "mock" ? <MockExam assessments={data.assessments.filter(a => a.kind === "mock")} /> : id === "challenges" ? <CompactChallenges offeringId={data.offering_id} /> : id === "class-quizzes" ? <CourseQuizzes offering={data.offering_id} /> : null}
        </section>
      ))}
    </>
  );
}

function ActiveAttempt({ error }: { error: unknown }) {
  const attemptId = isApiError(error, "ATTEMPT_ACTIVE") ? error.field_errors?.attempt_id : null;
  return typeof attemptId === "string" ? <Button asChild variant="secondary" size="sm"><Link href={`/attempts/${attemptId}`}>Resume current attempt</Link></Button> : null;
}

function TopicQuiz({ data }: { data: CourseOverview }) {
  const options = useTopicQuizOptions(data.offering_id);
  const start = useStartTopicQuiz();
  const router = useRouter();
  const analytics = useAnalytics();
  const [selected, setSelected] = useState<string[]>([]);
  const [requested, setRequested] = useState("20");
  const topics = options.data?.topics ?? [];
  const available = topics.filter(t => selected.includes(t.lesson_id) && t.question_count > 0);
  const poolSize = available.reduce((sum, t) => sum + t.question_count, 0);
  const max = Math.min(100, poolSize);
  const count = Number(requested);
  const valid = selected.length > 0 && selected.length <= 30 && available.length === selected.length && Number.isInteger(count) && count >= selected.length && count <= max;
  const reviews = data.assessments.filter(a => a.kind === "review");
  const begin = () => {
    if (!valid) return;
    start.mutate({ offeringId: data.offering_id, lessonIds: selected, questionCount: count }, {
      onSuccess: attempt => {
        analytics.track({ name: "attempt_started", assessment_kind: attempt.kind, attempt_id: attempt.attempt_id });
        router.push(`/attempts/${attempt.attempt_id}`);
      },
    });
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Your topics</h2><span aria-live="polite" className="text-xs text-ink-muted">{selected.length} selected</span></div>
      {options.isPending ? <p role="status" className="text-sm text-ink-muted">Loading topics…</p> : options.isError ? <ErrorState error={options.error} onRetry={() => void options.refetch()} /> : topics.length === 0 ? <p className="text-sm text-ink-muted">Topics will appear here when your course content is ready.</p> : (
        <fieldset disabled={start.isPending} className="grid min-w-0 gap-x-6 sm:grid-cols-2">
          <legend className="sr-only">Choose up to 30 topics to practise</legend>
          {topics.map(topic => (
            <label key={topic.lesson_id} className="flex min-h-11 min-w-0 items-center gap-2.5 py-2 text-sm">
              <input type="checkbox" className="size-4 shrink-0 accent-brand-primary" checked={selected.includes(topic.lesson_id)} disabled={topic.question_count === 0 || (selected.length >= 30 && !selected.includes(topic.lesson_id))}
                onChange={event => {
                  const next = event.target.checked ? [...selected, topic.lesson_id] : selected.filter(id => id !== topic.lesson_id);
                  setSelected(next);
                  const total = topics.filter(t => next.includes(t.lesson_id)).reduce((sum, t) => sum + t.question_count, 0);
                  setRequested(String(Math.min(Math.max(20, next.length), total, 100)));
                }} />
              <span className={`min-w-0 break-words ${topic.question_count === 0 ? "text-ink-muted" : ""}`}>{topic.title}</span>
              <span className="ml-auto shrink-0 text-xs text-ink-muted">{topic.question_count ? pluralize(topic.question_count, "question") : "Coming soon"}</span>
            </label>
          ))}
        </fieldset>
      )}
      {options.data?.active_attempt_id ? <Button asChild size="sm" variant="secondary"><Link href={`/attempts/${options.data.active_attempt_id}`}>Resume your quiz</Link></Button> : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <label htmlFor="quiz-count" className="flex items-center gap-2 text-xs text-ink-muted">Questions
          <Input id="quiz-count" type="number" inputMode="numeric" min={Math.max(1, selected.length)} max={max || 100} step={1} value={requested} onChange={e => setRequested(e.target.value)} disabled={!poolSize || start.isPending} className="w-16" aria-describedby="quiz-count-hint" />
        </label>
        <span className="hidden items-center gap-1 text-xs text-ink-muted sm:inline-flex"><Coffee className="size-3.5" aria-hidden />No time limit</span>
        <Button size="sm" className="ml-auto" loading={start.isPending} disabled={!valid || Boolean(options.data?.active_attempt_id)} onClick={begin}>Start quiz <ArrowRight aria-hidden /></Button>
      </div>
      <p id="quiz-count-hint" className="text-xs text-ink-muted">{selected.length ? `Choose ${selected.length}–${max} questions. Every selected topic is included.` : "Select topics to build your quiz."} Results and explanations appear after submission.</p>
      <p className="text-xs text-ink-muted">{ASSESSMENT_XP_COPY.practice}</p>
      <InlineError error={start.error} /><ActiveAttempt error={start.error} />
      {reviews.length > 0 ? <details className="border-t border-line pt-3"><summary className="cursor-pointer text-xs font-semibold text-ink-muted">Topic checks</summary><ul className="mt-2 divide-y divide-line">{reviews.map(a => <li key={a.assessment_version_id} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0 break-words text-sm">{a.title}</span><Button asChild size="sm" variant="ghost"><Link href={a.active_attempt_id ? `/attempts/${a.active_attempt_id}` : `/study/assessments/${a.assessment_version_id}?offering=${data.offering_id}`}>{a.active_attempt_id ? "Resume" : "Open"}</Link></Button></li>)}</ul></details> : null}
    </div>
  );
}

function MockExam({ assessments }: { assessments: CourseAssessment[] }) {
  const [chosen, setChosen] = useState("");
  const assessment = assessments.find(a => a.assessment_version_id === chosen) ?? assessments[0];
  return !assessment ? <p className="text-sm text-ink-muted">Mock exams will appear here when questions are ready.</p> : (
    <div className="space-y-4">
      {assessments.length > 1 ? <label className="block space-y-1 text-xs text-ink-muted">Exam<NativeSelect value={assessment.assessment_version_id} onChange={e => setChosen(e.target.value)}>{assessments.map(a => <option key={a.assessment_version_id} value={a.assessment_version_id}>{a.title}</option>)}</NativeSelect></label> : null}
      <MockSession key={assessment.assessment_version_id} assessment={assessment} />
    </div>
  );
}

function MockSession({ assessment: a }: { assessment: CourseAssessment }) {
  const router = useRouter();
  const analytics = useAnalytics();
  const start = useStartAttempt();
  const [confirm, setConfirm] = useState(false);
  const count = Math.min(50, a.question_count);
  const duration = a.duration_seconds === null ? 3600 : Math.min(14400, Math.max(60, Math.ceil(a.duration_seconds / 60) * 60));
  const begin = () => start.mutate({ assessmentVersionId: a.assessment_version_id, questionCount: count, durationSeconds: duration }, {
    onSuccess: attempt => {
      analytics.track({ name: "attempt_started", assessment_kind: attempt.kind, attempt_id: attempt.attempt_id });
      router.push(`/attempts/${attempt.attempt_id}`);
    },
  });
  return (
    <>
      <div><h2 className="text-sm font-semibold">{a.title}</h2><p className="mt-1 text-sm text-ink-muted">A timed practice exam. Results after submission.</p></div>
      <p className="text-xs text-ink-muted">{ASSESSMENT_XP_COPY.mock}</p>
      <div className="my-4 flex flex-wrap gap-x-6 gap-y-2 text-sm"><span>{pluralize(count, "question")}</span><span className="inline-flex items-center gap-1.5"><Timer className="size-4 text-ink-muted" aria-hidden />{formatDuration(duration)}</span></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3"><p className="text-xs text-ink-muted">The timer keeps running if you leave.</p>{a.active_attempt_id ? <Button asChild size="sm"><Link href={`/attempts/${a.active_attempt_id}`}>Resume exam</Link></Button> : <Button size="sm" onClick={() => setConfirm(true)}>Start mock exam <ArrowRight aria-hidden /></Button>}</div>
      <InlineError error={start.error} /><ActiveAttempt error={start.error} />
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Start the timer?" description={`${pluralize(count, "question")} · ${formatDuration(duration)}. The timer starts now and keeps running if you leave.`} confirmLabel="Start exam" onConfirm={begin} loading={start.isPending}><InlineError error={start.error} /><ActiveAttempt error={start.error} /></ConfirmDialog>
    </>
  );
}

function CompactChallenges({ offeringId }: { offeringId: string }) {
  const [offset, setOffset] = useState(0);
  const query = useQuery({ queryKey: ["course-challenges", offeringId, offset], queryFn: () => challengeApi().list(offeringId, offset), staleTime: 0, refetchInterval: 15000 });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">From your lecturers</h2>{query.data?.teacher ? <Button asChild size="sm" variant="secondary"><Link href={`/lecturer/courses/${offeringId}/challenges/new`}>Create challenge</Link></Button> : null}</div>
      <Failure error={query.error} retry={() => void query.refetch()} />
      {query.isPending ? <p role="status" className="text-sm text-ink-muted">Loading challenges…</p> : null}
      {query.data?.items.length === 0 ? <p className="text-sm text-ink-muted">Challenges from your lecturers will appear here.</p> : null}
      <ul className="divide-y divide-line">{query.data?.items.map(c => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-semibold">{c.title}</h3><Badge tone={c.state === "active" ? "brand" : "neutral"} className="px-2 py-0.5 capitalize">{c.state === "active" ? "Open" : c.state}</Badge></div><p className="mt-1 text-xs text-ink-muted">{pluralize(c.question_count, "question")} · {c.duration_minutes} min{c.starts_at ? ` · ${new Date(c.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : ""}</p></div>
          <Button asChild size="sm" variant="outline"><Link href={`/challenges/${c.id}`}>{c.state === "active" ? "Open" : c.state === "finished" ? "Results" : "Details"}</Link></Button>
        </li>
      ))}</ul>
      {offset > 0 || query.data?.items.length === 20 ? <Paging offset={offset} hasMore={query.data?.items.length === 20} change={setOffset} /> : null}
    </div>
  );
}
