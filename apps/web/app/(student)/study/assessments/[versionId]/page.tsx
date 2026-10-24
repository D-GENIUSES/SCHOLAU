"use client";

import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useState } from "react";
import { type CourseAssessment, isApiError } from "@scholau/api";
import { useCourseOverview, useStartAttempt } from "@scholau/api/react";
import { ASSESSMENT_KIND_LABEL, COPY, formatDuration, pluralize } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";
import { useAnalytics } from "@/lib/analytics";

export default function AssessmentIntroPage() {
  return (
    <Suspense fallback={<LoadingState variant="assessment" label="Loading assessment…" />}>
      <AssessmentIntro />
    </Suspense>
  );
}

function AssessmentIntro() {
  const { versionId } = useParams<{ versionId: string }>();
  const offering = useSearchParams().get("offering") ?? undefined;
  const overview = useCourseOverview(offering);

  if (!offering) {
    return (
      <EmptyState
        title="We couldn't find this assessment"
        description="Open assessments from a course page in Study."
        action={
          <Button asChild>
            <Link href="/home">Go to Home</Link>
          </Button>
        }
      />
    );
  }

  const backLink = (
    <Link
      href={`/study/courses/${offering}`}
      className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-brand-primary hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden /> Back to course
    </Link>
  );

  if (overview.isPending) {
    return (
      <>
        {backLink}
        <LoadingState variant="assessment" label="Loading assessment…" />
      </>
    );
  }
  if (overview.isError) {
    const removed = isApiError(overview.error, "CONTENT_UNAVAILABLE");
    return (
      <>
        {backLink}
        {removed ? (
          <EmptyState
            title={COPY.empty.contentRemoved}
            action={
              <Button asChild>
                <Link href="/home">Back to Home</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
        )}
      </>
    );
  }

  const assessment = overview.data.assessments.find((a) => a.assessment_version_id === versionId);
  if (!assessment) {
    return (
      <>
        {backLink}
        <EmptyState
          title="This assessment has been updated"
          description="It may have a newer version or be under review. Choose it again from the course page."
          action={
            <Button asChild>
              <Link href={`/study/courses/${offering}`}>Open course</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      {backLink}
      <Intro key={assessment.assessment_version_id} assessment={assessment} courseTitle={overview.data.course.title} />
    </>
  );
}

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-semibold">{title}</p>
        <div className="text-ink-muted">{children}</div>
      </div>
    </li>
  );
}

function xpRule(a: CourseAssessment): string {
  if (a.kind === "practice" || a.kind === "mock") return "1 XP per correct answer on each submitted attempt. No completion bonus.";
  const max = 20;
  return `Up to ${max} XP based on your best score. Improve your best to earn the difference.`;
}

function Intro({ assessment: a, courseTitle }: { assessment: CourseAssessment; courseTitle: string }) {
  const router = useRouter();
  const analytics = useAnalytics();
  const start = useStartAttempt();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const customizable = a.kind === "mock" || a.kind === "practice";
  const configuring = customizable && !a.active_attempt_id;
  const [questionCount, setQuestionCount] = useState(String(Math.min(30, a.question_count)));
  const [minutes, setMinutes] = useState("30");
  const [untimed, setUntimed] = useState(a.kind === "practice");
  const count = configuring ? Number(questionCount) : a.question_count;
  const duration = configuring ? (untimed ? null : Number(minutes) * 60) : a.duration_seconds;
  const validCount = Number.isInteger(count) && count >= 1 && count <= a.question_count;
  const validTime = duration === null || (Number.isInteger(Number(minutes)) && Number(minutes) >= 1 && Number(minutes) <= 240);
  const valid = !configuring || (validCount && validTime);
  const timed = duration !== null;
  const activeId = isApiError(start.error, "ATTEMPT_ACTIVE") ? start.error.field_errors?.attempt_id : undefined;
  const activeFromError = typeof activeId === "string" ? activeId : null;

  const begin = () =>
    start.mutate(
      { assessmentVersionId: a.assessment_version_id, ...(configuring ? { questionCount: count, durationSeconds: duration } : {}) },
      {
        onSuccess: (attempt) => {
          analytics.track({ name: "attempt_started", assessment_kind: attempt.kind, attempt_id: attempt.attempt_id });
          router.push(`/attempts/${attempt.attempt_id}`);
        },
      },
    );

  return (
    <>
      <PageHeader eyebrow={`${ASSESSMENT_KIND_LABEL[a.kind]} · ${courseTitle}`} title={a.title} />

      <Card>
        <CardContent className="pt-4 sm:pt-6">
          {configuring ? <fieldset disabled={start.isPending} className="mb-5 rounded-control border border-line bg-surface-tint p-4">
            <legend className="px-1 font-semibold">Choose your session</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="attempt-count" label="Number of questions" hint={`Choose 1–${a.question_count}. Questions are randomly selected from this assessment.`} error={validCount ? undefined : `Enter a whole number from 1 to ${a.question_count}.`}>
                <Input type="number" inputMode="numeric" min={1} max={a.question_count} step={1} value={questionCount} onChange={event => setQuestionCount(event.target.value)} />
              </Field>
              <Field id="attempt-minutes" label="Time limit (minutes)" hint={untimed ? "No countdown for this practice session." : "Choose 1–240 minutes. The timer continues if you leave."} error={!untimed && !validTime ? "Enter a whole number from 1 to 240." : undefined}>
                <Input type="number" inputMode="numeric" min={1} max={240} step={1} disabled={untimed} value={minutes} onChange={event => setMinutes(event.target.value)} />
              </Field>
            </div>
            {a.kind === "practice" ? <label className="mt-3 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={untimed} onChange={event => setUntimed(event.target.checked)} className="size-4 accent-brand-primary" />Practice without a timer</label> : null}
          </fieldset> : null}
          <ul className="flex flex-col gap-4">
            <Rule title={a.active_attempt_id ? "Saved session" : validCount ? pluralize(count, "question") : "Choose your question count"}>
              {a.active_attempt_id ? "Resume with the question count and time limit saved when you started." : "Single-choice questions."}
            </Rule>
            {!a.active_attempt_id ? <Rule title={timed ? validTime ? formatDuration(duration) : "Choose your time limit" : "Untimed"}>
              {timed ? COPY.learning.timerRule : "Take as long as you need."}
            </Rule> : null}
            <Rule title="Feedback">
              {a.feedback_mode === "immediate"
                ? "Immediate feedback after each answer. Your first checked answer is locked."
                : "Results and explanations appear after you submit."}
            </Rule>
            <Rule title="XP">
              <p>{xpRule(a)}</p>
              <p>{COPY.learning.capReset}</p>
            </Rule>
            <Rule title="Saving">
              Your answers are saved to the server as you go. Answers that haven&apos;t reached the server are marked “
              {COPY.learning.unsaved}”.
            </Rule>
          </ul>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          {activeFromError ? (
            <Alert
              tone="info"
              title="You already have an attempt in progress"
              action={
                <Button asChild size="sm">
                  <Link href={`/attempts/${activeFromError}`}>Resume attempt</Link>
                </Button>
              }
            />
          ) : (
            <InlineError error={start.error} />
          )}
          {a.active_attempt_id ? (
            <Button asChild block>
              <Link href={`/attempts/${a.active_attempt_id}`}>
                <Play className="size-4" aria-hidden /> Resume attempt
              </Link>
            </Button>
          ) : (
            <Button block disabled={!valid} loading={start.isPending && !confirmOpen} onClick={() => (timed ? setConfirmOpen(true) : begin())}>
              <Play className="size-4" aria-hidden /> Start {ASSESSMENT_KIND_LABEL[a.kind].toLowerCase()}
            </Button>
          )}
        </CardFooter>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Start the timer?"
        description="The timer starts now and keeps running if you leave."
        confirmLabel="Start now"
        onConfirm={begin}
        loading={start.isPending}
      >
        <p className="text-sm text-ink-muted">
          {formatDuration(duration)} for {pluralize(count, "question")}. {COPY.learning.timerRule}
        </p>
        <InlineError error={start.error} />
      </ConfirmDialog>
    </>
  );
}
