"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { type CourseOverview, isApiError } from "@scholau/api";
import { useCourseOverview, useEnrollCourse } from "@scholau/api/react";
import { COPY, pluralize } from "@scholau/core";
import { CourseLearningMap } from "@/components/home/course-learning-map";
import { TopicMastery } from "@/components/lesson/topic-mastery";
import { CourseLightAssignments } from "@/components/lesson/course-light-assignments";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, Progress } from "@/components/ui/misc";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";
import { resolveContinueLesson, resolveContinueLessonId } from "@/lib/continue-lesson";

function BackToHome() {
  return (
    <Link href="/home" className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-brand-primary hover:underline">
      <ArrowLeft className="size-4" aria-hidden /> Home
    </Link>
  );
}

export default function CourseOverviewPage() {
  const { offeringId } = useParams<{ offeringId: string }>();
  const overview = useCourseOverview(offeringId);
  const enroll = useEnrollCourse();

  if (overview.data) return <Overview data={overview.data} />;

  if (overview.isError) {
    if (isApiError(overview.error, "NOT_ENROLLED")) {
      return (
        <>
          <BackToHome />
          <EmptyState
            title="Enroll to open this course"
            description="You need to be enrolled to see lessons, assessments and your progress."
            action={
              <div className="flex flex-col items-center gap-2">
                <Button
                  loading={enroll.isPending}
                  onClick={() =>
                    enroll.mutate({ offeringId }, { onSuccess: () => void overview.refetch() })
                  }
                >
                  Enroll in this course
                </Button>
                <InlineError error={enroll.error} />
              </div>
            }
          />
        </>
      );
    }
    if (isApiError(overview.error, "CONTENT_UNAVAILABLE")) {
      return (
        <>
          <BackToHome />
          <EmptyState
            title={COPY.empty.contentRemoved}
            description="This course isn't available right now. Please check back later."
            action={
              <Button asChild>
                <Link href="/home">Back to Home</Link>
              </Button>
            }
          />
        </>
      );
    }
    return (
      <>
        <BackToHome />
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      </>
    );
  }

  return (
    <>
      <BackToHome />
      <LoadingState variant="course" label="Loading course…" />
    </>
  );
}

function courseStatsLine(data: CourseOverview): string | null {
  const parts: string[] = [];
  if (data.unit_count != null) parts.push(pluralize(data.unit_count, "unit"));
  if (data.requirement_status) parts.push(`Status ${data.requirement_status}`);
  if (data.lecture_hours != null || data.practical_hours != null) {
    parts.push(
      `Lecture ${data.lecture_hours ?? "—"} h · Practical ${data.practical_hours ?? "—"} h`,
    );
  }
  return parts.length ? parts.join(" · ") : null;
}

function primaryLessonCta(
  data: CourseOverview,
): { href: string; label: string; ariaLabel: string } | null {
  const { progress } = data;
  if (progress.lessons_total === 0) return null;
  const target = resolveContinueLesson(data.modules);
  if (!target) return null;
  const isResume = target.state === "started";
  const hasAnyCompleted = progress.lessons_completed > 0;
  const label = isResume
    ? "Continue learning"
    : hasAnyCompleted
      ? "Start next lesson"
      : "Start first lesson";
  return {
    href: `/study/lessons/${target.lesson_id}`,
    label,
    ariaLabel: `${label}: ${target.title}`,
  };
}

function Overview({ data }: { data: CourseOverview }) {
  const { progress } = data;
  const continueLessonId = useMemo(
    () => resolveContinueLessonId(data.modules),
    [data.modules],
  );
  const statsLine = courseStatsLine(data);
  const lessonCta = primaryLessonCta(data);

  return (
    <>
      <BackToHome />
      <PageHeader
        eyebrow={data.course.code}
        title={data.course.title}
        description={data.course.description ?? undefined}
      />

      {statsLine ? (
        <p className="mb-4 text-sm text-ink-muted">{statsLine}</p>
      ) : null}

      {progress.lessons_total > 0 ? (
        <Card className="mb-5 border-line bg-surface-tint shadow-none">
          <CardContent className="flex flex-col gap-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
              <h2 className="font-semibold">Your progress</h2>
              <p className="text-ink-muted">
                {progress.lessons_completed}/{progress.lessons_total} completed{" "}
                <strong className="ml-1 text-brand-primary">{progress.percent}%</strong>
              </p>
            </div>
            <Progress
              value={progress.percent}
              label="Lessons completed"
              tone={progress.percent >= 100 ? "success" : "brand"}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {lessonCta ? (
                <Button asChild className="w-full sm:w-auto">
                  <Link href={lessonCta.href} aria-label={lessonCta.ariaLabel}>
                    {lessonCta.label}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              ) : progress.percent >= 100 ? (
                <p className="text-sm font-medium text-success">All lessons complete — great work.</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {data.battle_ready ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/battles?offering=${data.offering_id}`}>Start a battle</Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/courses/${data.offering_id}/challenges`}>Course challenges</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/study/courses/${data.offering_id}/materials`}>Suggest material</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="mb-4 text-ink-muted">
          Content coming soon. Published lessons and assessments will appear here when ready.
        </p>
      )}

      <section aria-labelledby="course-lessons-heading" className="mb-6 flex flex-col gap-3">
        <h2 id="course-lessons-heading" className="text-lg font-bold">
          Lessons
        </h2>
        <CourseLearningMap
          overview={data}
          continueLessonId={continueLessonId}
          preview={false}
          showProgressSummary={false}
        />
      </section>

      <CourseLightAssignments offeringId={data.offering_id} />
      <TopicMastery offeringId={data.offering_id} />

      <section
        aria-labelledby="assessments-heading"
        className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface-card p-4"
      >
        <div>
          <h2 id="assessments-heading" className="text-base font-semibold">
            Assessments
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Topic quizzes, timed mock exams, lecturer challenges and class quizzes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/study/courses/${data.offering_id}/assessments`}>Open assessments</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/study/courses/${data.offering_id}/assessments?tab=class-quizzes`}>Class quizzes</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
