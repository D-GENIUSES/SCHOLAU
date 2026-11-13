"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Clock, RefreshCw, Target } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { type CompleteLessonResult, isApiError, type Lesson } from "@scholau/api";
import { useCompleteLesson, useCourseOverview, useHomeSummary, useLesson, useStartLesson } from "@scholau/api/react";
import { briefFlashcardBack, COPY, formatDate, formatXpDelta, pluralize } from "@scholau/core";
import { FIRST_LESSON_CELEBRATION_MS } from "@/components/lesson/first-lesson-celebration";
import { LessonStepper } from "@/components/lesson/lesson-stepper";
import { FlashcardDeck } from "@/components/lesson/flashcard-deck";
import { LessonClips } from "@/components/lesson/lesson-clips";
import { XpCapNotice } from "@/components/lesson/xp-cap-notice";
import { ReportDialog } from "@/components/report-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";
import { useAnalytics } from "@/lib/analytics";
import { buildExamFlashcards, lessonCardText } from "@/lib/lesson-exam-cards";
import { playLessonCompleteSound } from "@/lib/feedback-sounds";
import { celebrationPayload, emitStreakCelebration } from "@/lib/streak-celebration-bus";
import { shouldCelebrateStreak } from "@/lib/streak-celebration";
import { cn } from "@/lib/utils";

export default function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const lesson = useLesson(lessonId);

  if (lesson.data) return <LessonReader key={lesson.data.lesson_id} lesson={lesson.data} />;

  if (lesson.isError) {
    if (isApiError(lesson.error, "CONTENT_UNAVAILABLE") || isApiError(lesson.error, "NOT_ENROLLED")) {
      const removed = isApiError(lesson.error, "CONTENT_UNAVAILABLE");
      return (
        <div className="mx-auto max-w-reading">
          <EmptyState
            title={removed ? COPY.empty.contentRemoved : "Enroll to read this lesson"}
            description={
              removed
                ? "This lesson isn't available right now. Please check back later."
                : "This lesson belongs to a course you're not enrolled in."
            }
            action={
              <Button asChild>
                <Link href="/home">Back to Home</Link>
              </Button>
            }
          />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-reading">
        <ErrorState error={lesson.error} onRetry={() => void lesson.refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-reading">
      <LoadingState variant="lesson" label="Loading lesson…" lines={5} />
    </div>
  );
}

function LessonReader({ lesson }: { lesson: Lesson }) {
  const analytics = useAnalytics();
  const course = useCourseOverview(lesson.offering_id);
  const start = useStartLesson();
  const home = useHomeSummary();
  const [deckFinished, setDeckFinished] = useState(false);
  const complete = useCompleteLesson({ firstLessonCelebrationMs: FIRST_LESSON_CELEBRATION_MS });
  const examCards = useMemo(() => {
    if (lesson.flashcards?.length) {
      return lesson.flashcards
        .map((card, index) => ({
          id: `${lesson.lesson_id}-fc-${index}`,
          front: lessonCardText(card.front),
          back: briefFlashcardBack(card.back),
          tag: (card.tag as "focus" | "section" | "tip" | "checkpoint" | "diagram" | "recap" | undefined) ?? "section",
        }))
        .filter((card) => card.front && card.back);
    }
    return buildExamFlashcards(lesson);
  }, [lesson]);

  const { mutate: startMutate } = start;
  const startedFor = useRef<string | null>(null);
  const alreadyCompleted = lesson.progress?.state === "completed";
  useEffect(() => {
    if (alreadyCompleted || startedFor.current === lesson.lesson_version_id) return;
    startedFor.current = lesson.lesson_version_id;
    startMutate(lesson.lesson_version_id, {
      onSuccess: (r) => analytics.track({ name: "lesson_started", lesson_id: r.lesson_id }),
    });
  }, [alreadyCompleted, lesson.lesson_version_id, startMutate, analytics]);

  const markComplete = (retry = false) => {
    const previousStreak = home.data?.streak;
    void complete.mutateAsync(
      retry && complete.variables ? complete.variables : { lessonVersionId: lesson.lesson_version_id },
    ).then((r) => {
      if (shouldCelebrateStreak(r)) {
        emitStreakCelebration(celebrationPayload(previousStreak, r.streak));
      }
      if (!r.already_completed) {
        analytics.track({ name: "lesson_completed", lesson_id: r.lesson_id, xp_awarded: r.xp_awarded });
        if (!shouldCelebrateStreak(r)) playLessonCompleteSound();
      }
    }).catch(() => undefined);
  };

  const courseTitle = course.data?.course.title ?? "Course";
  const completedAt = complete.data?.completed_at ?? lesson.progress?.completed_at ?? null;
  const isCompleted = Boolean(complete.data) || alreadyCompleted;
  const reviewHref = lesson.review
    ? `/study/assessments/${lesson.review.assessment_version_id}?offering=${lesson.offering_id}`
    : null;
  const hasBlockContent = lesson.blocks.length > 0;
  const hasStructuredMaths = lesson.blocks.some(block => block.type === "worked_example" || block.type === "equation");
  const needsDeck = Boolean(examCards.length) && !hasStructuredMaths && !alreadyCompleted;
  const canMarkComplete = isCompleted || deckFinished || alreadyCompleted || hasStructuredMaths;
  const showUnlockHint = !isCompleted && hasBlockContent && needsDeck && !canMarkComplete;

  return (
    <article className="lesson-study mx-auto flex max-w-reading flex-col pb-28 sm:pb-8">
      <header className="lesson-study-header">
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-muted">
            <li>
              <Link href="/home" className="font-semibold text-brand-primary hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden>
              <ChevronRight className="size-4" />
            </li>
            <li>
              <Link href={`/study/courses/${lesson.offering_id}`} className="font-semibold text-brand-primary hover:underline">
                {courseTitle}
              </Link>
            </li>
            {lesson.module ? (
              <>
                <li aria-hidden>
                  <ChevronRight className="size-4" />
                </li>
                <li aria-current="page" className="truncate">
                  {lesson.module.title}
                </li>
              </>
            ) : null}
          </ol>
        </nav>

        <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-[1.75rem]">{lesson.title}</h1>

        <div className="mt-3 flex flex-col gap-2">
          {lesson.objective ? (
            <p className="flex items-start gap-2 text-sm text-ink-muted">
              <Target className="mt-0.5 size-4 shrink-0 text-brand-primary" aria-hidden />
              <span className="line-clamp-2">
                <span className="font-semibold text-ink">Objective: </span>
                {lesson.objective}
              </span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-4" aria-hidden /> About {pluralize(lesson.estimated_minutes, "minute")}
            </span>
            {isCompleted ? (
              <Badge tone="success">
                <CheckCircle2 className="size-3.5" aria-hidden /> Completed
                {completedAt ? ` ${formatDate(completedAt)}` : ""}
              </Badge>
            ) : null}
          </div>
        </div>
      </header>

      {hasBlockContent ? (
        <>
          <section className="lesson-study-phase" aria-labelledby="lesson-read-heading">
            <p id="lesson-read-heading" className="lesson-phase-label">
              Read
            </p>
            <LessonStepper key={lesson.lesson_version_id} blocks={lesson.blocks} lessonId={lesson.lesson_id} version={lesson.lesson_version_id} />
          </section>

          <details className="lesson-study-videos">
            <summary>Videos</summary>
            <div className="lesson-study-videos-body">
              <LessonClips lesson={lesson} embedded />
            </div>
          </details>

          {examCards.length ? (
            <section className="lesson-study-phase lesson-study-check" aria-labelledby="lesson-flashcards-heading">
              <div className="mb-3">
                <p className="lesson-phase-label">Study notes</p>
                <h2 id="lesson-flashcards-heading" className="text-lg font-bold tracking-tight sm:text-xl">
                  Compact recap
                </h2>
              </div>
              <FlashcardDeck cards={examCards} onLastCardReached={hasStructuredMaths ? undefined : () => setDeckFinished(true)} />
              {showUnlockHint ? (
                <p className="mt-3 text-center text-sm text-ink-muted">Reach the last card to unlock Mark as complete.</p>
              ) : null}
            </section>
          ) : null}
        </>
      ) : (
        <EmptyState title="This lesson has no content yet" description={COPY.empty.contentRemoved} />
      )}

      <section className="lesson-study-phase mt-8" aria-labelledby="lesson-done-heading">
        <p id="lesson-done-heading" className="lesson-phase-label">
          Done
        </p>
        <div role="status" aria-live="polite" className="mb-3 flex flex-col gap-3">
          {complete.data ? <CompletionFeedback result={complete.data} /> : null}
        </div>
        {complete.isError ? (
          <div className="mb-3 flex flex-col gap-2">
            <InlineError error={complete.error} />
            <div>
              <Button variant="outline" onClick={() => markComplete(true)}>
                <RefreshCw className="size-4" aria-hidden /> Try again
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <div
        className={cn(
          "lesson-complete-bar",
          canMarkComplete && !isCompleted && "is-ready",
          isCompleted && "is-done",
        )}
      >
        <div className="lesson-complete-bar-inner">
          {isCompleted ? (
            reviewHref ? (
              <Button asChild>
                <Link href={reviewHref}>Review this lesson</Link>
              </Button>
            ) : lesson.next_lesson_id ? (
              <Button asChild>
                <Link href={`/study/lessons/${lesson.next_lesson_id}`}>
                  Next lesson <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href={`/study/courses/${lesson.offering_id}`}>Back to course</Link>
              </Button>
            )
          ) : (
            <Button
              onClick={() => markComplete()}
              loading={complete.isPending}
              disabled={complete.isError || !canMarkComplete}
            >
              <CheckCircle2 className="size-4" aria-hidden /> Mark as complete
            </Button>
          )}
          {isCompleted && reviewHref && lesson.next_lesson_id ? (
            <Button asChild variant="outline">
              <Link href={`/study/lessons/${lesson.next_lesson_id}`}>
                Next lesson <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          ) : null}
          {!isCompleted && reviewHref ? (
            <Button asChild variant="outline">
              <Link href={reviewHref}>Review</Link>
            </Button>
          ) : null}
          <ReportDialog targetType="lesson" targetId={lesson.lesson_id} triggerLabel="Report" />
        </div>
      </div>

      <nav aria-label="Lesson navigation" className="mt-6 flex flex-wrap justify-between gap-2 text-sm">
        {lesson.previous_lesson_id ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/study/lessons/${lesson.previous_lesson_id}`}>
              <ArrowLeft className="size-4" aria-hidden /> Previous lesson
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {lesson.next_lesson_id ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/study/lessons/${lesson.next_lesson_id}`}>
              Next lesson <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/study/courses/${lesson.offering_id}`}>Back to course</Link>
          </Button>
        )}
      </nav>
    </article>
  );
}

function CompletionFeedback({ result }: { result: CompleteLessonResult }) {
  if (result.already_completed) {
    return <Alert tone="info" title="You've already completed this lesson">No additional XP is awarded for repeat completions.</Alert>;
  }
  return (
    <>
      <Alert tone="success" title="Lesson complete">
        {result.xp_awarded > 0 ? `You earned ${formatXpDelta(result.xp_awarded)}.` : "Complete the lesson knowledge check to earn up to 20 XP."}
      </Alert>
      {result.xp_capped ? <XpCapNotice /> : null}
    </>
  );
}
