"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Clock, RefreshCw, Target } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { type CompleteLessonResult, isApiError, type Lesson } from "@scholau/api";
import { useCompleteLesson, useCourseOverview, useHomeSummary, useLesson, useStartLesson } from "@scholau/api/react";
import { COPY, formatDate, formatXpDelta, pluralize } from "@scholau/core";
import { FirstLessonCelebration, FIRST_LESSON_CELEBRATION_MS } from "@/components/lesson/first-lesson-celebration";
import { LessonBlocks } from "@/components/lesson/blocks";
import { FlashcardDeck } from "@/components/lesson/flashcard-deck";
import { XpCapNotice } from "@/components/lesson/xp-cap-notice";
import { ReportDialog } from "@/components/report-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/misc";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";
import { useAnalytics } from "@/lib/analytics";
import { buildExamFlashcards } from "@/lib/lesson-exam-cards";
import { shouldCelebrateStreak } from "@/lib/streak-celebration";

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
                <Link href="/study">Back to Study</Link>
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
  const [streakCelebration, setStreakCelebration] = useState<{ days: number; localDate: string; previousDays: number } | null>(null);
  const [deckFinished, setDeckFinished] = useState(false);
  const complete = useCompleteLesson({ firstLessonCelebrationMs: FIRST_LESSON_CELEBRATION_MS });
  const examCards = useMemo(() => buildExamFlashcards(lesson), [lesson]);

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
    complete.mutate(
      retry && complete.variables ? complete.variables : { lessonVersionId: lesson.lesson_version_id },
      {
        onSuccess: (r) => {
          if (shouldCelebrateStreak(r, previousStreak)) {
            setStreakCelebration({ days: r.streak.current, localDate: r.streak.local_date, previousDays: r.streak.current === 1 ? 0 : previousStreak?.current ?? r.streak.current - 1 });
          }
          if (!r.already_completed) analytics.track({ name: "lesson_completed", lesson_id: r.lesson_id, xp_awarded: r.xp_awarded });
        },
      },
    );
  };

  const courseTitle = course.data?.course.title ?? "Course";
  const completedAt = complete.data?.completed_at ?? lesson.progress?.completed_at ?? null;
  const isCompleted = Boolean(complete.data) || alreadyCompleted;
  const reviewHref = lesson.review
    ? `/study/assessments/${lesson.review.assessment_version_id}?offering=${lesson.offering_id}`
    : null;
  const hasBlockContent = lesson.blocks.length > 0;
  const canMarkComplete = isCompleted || deckFinished || alreadyCompleted;

  return (
    <article className="mx-auto flex max-w-reading flex-col">
      {streakCelebration ? (
        <FirstLessonCelebration key={streakCelebration.localDate} {...streakCelebration} />
      ) : null}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-muted">
          <li>
            <Link href="/study" className="font-semibold text-brand-primary hover:underline">
              Study
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
              <li aria-current="page">{lesson.module.title}</li>
            </>
          ) : null}
        </ol>
      </nav>

      <PageHeader title={lesson.title} />

      <div className="mb-6 flex flex-col gap-2">
        {lesson.objective ? (
          <p className="flex items-start gap-2">
            <Target className="mt-1 size-4 shrink-0 text-brand-primary" aria-hidden />
            <span>
              <span className="font-semibold">Objective: </span>
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
              <CheckCircle2 className="size-3.5" aria-hidden /> Completed{completedAt ? ` ${formatDate(completedAt)}` : ""}
            </Badge>
          ) : null}
        </div>
      </div>

      {hasBlockContent ? (
        <>
          <FlashcardDeck cards={examCards} onLastCardReached={() => setDeckFinished(true)} />
          <details className="mt-2 rounded-control border border-line bg-surface-page">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand-primary">View original notes</summary>
            <div className="border-t border-line px-4 py-4">
              <LessonBlocks blocks={lesson.blocks} />
            </div>
          </details>
        </>
      ) : (
        <EmptyState title="This lesson has no content yet" description={COPY.empty.contentRemoved} />
      )}

      {!isCompleted && hasBlockContent && !canMarkComplete ? (
        <p className="text-sm text-ink-muted">Flip through to the last flashcard to unlock Mark as complete.</p>
      ) : null}

      <Card className="mt-8">
        <CardContent className="flex flex-col gap-4 pt-4 sm:pt-6">
          <div role="status" aria-live="polite" className="flex flex-col gap-3">
            {complete.data ? <CompletionFeedback result={complete.data} /> : null}
          </div>
          {complete.isError ? (
            <div className="flex flex-col gap-2">
              <InlineError error={complete.error} />
              <div>
                <Button variant="outline" onClick={() => markComplete(true)}>
                  <RefreshCw className="size-4" aria-hidden /> Try again
                </Button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
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
              ) : null
            ) : (
              <>
                <Button
                  onClick={() => markComplete()}
                  loading={complete.isPending}
                  disabled={complete.isError || !canMarkComplete}
                >
                  <CheckCircle2 className="size-4" aria-hidden /> Mark as complete
                </Button>
                {reviewHref ? (
                  <Button asChild variant="outline">
                    <Link href={reviewHref}>Review this lesson</Link>
                  </Button>
                ) : null}
              </>
            )}
            <ReportDialog targetType="lesson" targetId={lesson.lesson_id} triggerLabel="Report this lesson" />
          </div>
        </CardContent>
      </Card>

      <nav aria-label="Lesson navigation" className="mt-6 flex flex-wrap justify-between gap-2">
        {lesson.previous_lesson_id ? (
          <Button asChild variant="outline">
            <Link href={`/study/lessons/${lesson.previous_lesson_id}`}>
              <ArrowLeft className="size-4" aria-hidden /> Previous lesson
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {lesson.next_lesson_id ? (
          <Button asChild variant="outline">
            <Link href={`/study/lessons/${lesson.next_lesson_id}`}>
              Next lesson <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
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
