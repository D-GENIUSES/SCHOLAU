"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type CourseOverview, isApiError } from "@scholau/api";
import { useCourseOverview, useEnrollCourse } from "@scholau/api/react";
import { COPY, pluralize } from "@scholau/core";
import { ModuleSection } from "@/components/lesson/lesson-module";
import { TopicMastery } from "@/components/lesson/topic-mastery";
import { CourseLightAssignments } from "@/components/lesson/course-light-assignments";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, Progress } from "@/components/ui/misc";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";

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

function Overview({ data }: { data: CourseOverview }) {
  const { progress } = data;
  return (
    <>
      <BackToHome />
      <PageHeader
        eyebrow={data.course.code}
        title={data.course.title}
        description={data.course.description ?? undefined}
        actions={
          data.battle_ready ? (
            <Button asChild variant="secondary">
              <Link href={`/battles?offering=${data.offering_id}`}>
                Start a battle
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap gap-2"><Button asChild variant="secondary"><Link href={`/courses/${data.offering_id}/challenges`}>Course challenges</Link></Button><Button asChild variant="outline"><Link href={`/study/courses/${data.offering_id}/materials`}>Suggest study material</Link></Button></div>
      {data.unit_count != null ? <p className="mb-4 text-sm text-ink-muted">{pluralize(data.unit_count, "unit")} · Status {data.requirement_status}</p> : null}
      {progress.lessons_total === 0 ? <p className="mb-4 text-ink-muted">Content coming soon. Published lessons and assessments will appear here when ready.</p> : null}
      {data.lecture_hours != null || data.practical_hours != null ? <p className="mb-4 text-sm text-ink-muted">Lecture hours: {data.lecture_hours ?? "Not provided"} · Practical hours: {data.practical_hours ?? "Not provided"}</p> : null}
      <Card className="mb-5 border-[#d5e4f5] bg-surface-tint shadow-none">
        <CardContent className="flex flex-col gap-2 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
            <h2 className="font-semibold">Lesson progress</h2>
            <p className="text-ink-muted">{progress.lessons_completed}/{progress.lessons_total} completed <strong className="ml-2 text-brand-primary">{progress.percent}%</strong></p>
          </div>
          <Progress value={progress.percent} label="Lessons completed" tone={progress.percent >= 100 ? "success" : "brand"} />
        </CardContent>
      </Card>

      <CourseLightAssignments offeringId={data.offering_id} />
      <TopicMastery offeringId={data.offering_id} />
      <section aria-labelledby="lessons-heading" className="mb-6 flex flex-col gap-3">
        <h2 id="lessons-heading" className="text-xl font-bold">
          Lessons
        </h2>
        {data.modules.length === 0 ? (
          <EmptyState title="No lessons published yet" description="Lessons for this course will appear here." />
        ) : (
          data.modules.map((m, index) => <ModuleSection key={m.id} module={m} startAt={data.modules.slice(0, index).reduce((total, item) => total + item.lessons.length, 0)} />)
        )}
      </section>

      <section aria-labelledby="assessments-heading" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface-card p-4">
        <div><h2 id="assessments-heading" className="text-base font-semibold">Assessments</h2><p className="mt-1 text-sm text-ink-muted">Topic quizzes, timed mock exams and lecturer challenges.</p></div>
        <Button asChild size="sm"><Link href={`/study/courses/${data.offering_id}/assessments`}>Open assessments</Link></Button>
      </section>
    </>
  );
}
