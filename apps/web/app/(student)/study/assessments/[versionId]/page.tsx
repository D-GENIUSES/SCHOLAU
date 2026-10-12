"use client";

import { ArrowLeft, Clock, ListOrdered, Play, Save, Sparkles, Timer, MessageSquareText } from "lucide-react";
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
import { PageHeader } from "@/components/ui/misc";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";
import { useAnalytics } from "@/lib/analytics";

export default function AssessmentIntroPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading assessment…" />}>
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
            <Link href="/study">Go to Study</Link>
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
        <LoadingState label="Loading assessment…" />
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
                <Link href="/study">Back to Study</Link>
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
      <Intro assessment={assessment} courseTitle={overview.data.course.title} />
    </>
  );
}

function Rule({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-pill bg-surface-tint text-brand-primary" aria-hidden>
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-semibold">{title}</p>
        <div className="text-ink-muted">{children}</div>
      </div>
    </li>
  );
}

function xpRule(a: CourseAssessment): string {
  if (a.kind === "review") return "+2 XP for each question you answer correctly for the first time.";
  const amount = a.kind === "practice" ? "+10 XP" : "+20 XP";
  return a.first_completion_rewarded
    ? `You've already earned the first-completion XP (${amount}) for this ${a.kind === "practice" ? "practice set" : "mock exam"}.`
    : `${amount} the first time you complete this ${a.kind === "practice" ? "practice set" : "mock exam"}.`;
}

function Intro({ assessment: a, courseTitle }: { assessment: CourseAssessment; courseTitle: string }) {
  const router = useRouter();
  const analytics = useAnalytics();
  const start = useStartAttempt();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const timed = a.duration_seconds !== null;
  const activeId = isApiError(start.error, "ATTEMPT_ACTIVE") ? start.error.field_errors?.attempt_id : undefined;
  const activeFromError = typeof activeId === "string" ? activeId : null;

  const begin = () =>
    start.mutate(
      { assessmentVersionId: a.assessment_version_id },
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
          <ul className="flex flex-col gap-4">
            <Rule icon={<ListOrdered className="size-4" />} title={pluralize(a.question_count, "question")}>
              Single-choice questions.
            </Rule>
            <Rule icon={timed ? <Timer className="size-4" /> : <Clock className="size-4" />} title={timed ? formatDuration(a.duration_seconds) : "Untimed"}>
              {timed ? COPY.learning.timerRule : "Take as long as you need."}
            </Rule>
            <Rule icon={<MessageSquareText className="size-4" />} title="Feedback">
              {a.feedback_mode === "immediate"
                ? "Immediate feedback after each answer. Your first checked answer is locked."
                : "Results and explanations appear after you submit."}
            </Rule>
            <Rule icon={<Sparkles className="size-4" />} title="XP">
              <p>{xpRule(a)}</p>
              <p>Learning XP has a daily limit of 100 XP. {COPY.learning.capReset}</p>
            </Rule>
            <Rule icon={<Save className="size-4" />} title="Saving">
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
            <Button block loading={start.isPending && !confirmOpen} onClick={() => (timed ? setConfirmOpen(true) : begin())}>
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
          {formatDuration(a.duration_seconds)} for {pluralize(a.question_count, "question")}. {COPY.learning.timerRule}
        </p>
        <InlineError error={start.error} />
      </ConfirmDialog>
    </>
  );
}
