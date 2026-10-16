"use client";

import { ArrowLeft, Clock, Swords } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type CourseAssessment, type CourseModule, type CourseOverview, isApiError } from "@scholau/api";
import { useCourseOverview, useEnrollCourse } from "@scholau/api/react";
import { type AssessmentKind, COPY, formatDuration, pluralize } from "@scholau/core";
import { LessonStateBadge } from "@/components/lesson/lesson-state-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, PageHeader, Progress } from "@/components/ui/misc";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";

const GROUPS: { kind: AssessmentKind; title: string; description: string }[] = [
  { kind: "review", title: "Review", description: "Quick checks with immediate feedback." },
  { kind: "practice", title: "Practice", description: "Untimed sets; results after you submit." },
  { kind: "mock", title: "Mock exams", description: "Exam-style sets; results after you submit." },
];

function BackToStudy() {
  return (
    <Link href="/study" className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-brand-primary hover:underline">
      <ArrowLeft className="size-4" aria-hidden /> Study
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
          <BackToStudy />
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
          <BackToStudy />
          <EmptyState
            title={COPY.empty.contentRemoved}
            description="This course isn't available right now. Please check back later."
            action={
              <Button asChild>
                <Link href="/study">Back to Study</Link>
              </Button>
            }
          />
        </>
      );
    }
    return (
      <>
        <BackToStudy />
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      </>
    );
  }

  return (
    <>
      <BackToStudy />
      <LoadingState label="Loading course…" />
    </>
  );
}

function Overview({ data }: { data: CourseOverview }) {
  const { progress } = data;
  return (
    <>
      <BackToStudy />
      <PageHeader
        eyebrow={data.course.code}
        title={data.course.title}
        description={data.course.description ?? undefined}
        actions={
          data.battle_ready ? (
            <Button asChild variant="secondary">
              <Link href={`/battles?offering=${data.offering_id}`}>
                <Swords className="size-4" aria-hidden /> Battle on this course
              </Link>
            </Button>
          ) : null
        }
      />

      {data.unit_count != null ? <p className="mb-4 text-sm text-ink-muted">{pluralize(data.unit_count, "unit")} · Status {data.requirement_status}</p> : null}
      {progress.lessons_total === 0 ? <p className="mb-4 text-ink-muted">Content coming soon. Published lessons and assessments will appear here when ready.</p> : null}
      {data.lecture_hours != null || data.practical_hours != null ? <p className="mb-4 text-sm text-ink-muted">Lecture hours: {data.lecture_hours ?? "Not provided"} · Practical hours: {data.practical_hours ?? "Not provided"}</p> : null}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Lesson progress</CardTitle>
          <CardDescription>Counts completed lessons only. Assessment scores are shown with each assessment below.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="font-semibold">
            {progress.lessons_completed} of {pluralize(progress.lessons_total, "lesson")} completed ({progress.percent}%)
          </p>
          <Progress value={progress.percent} label="Lessons completed" tone={progress.percent >= 100 ? "success" : "brand"} />
        </CardContent>
      </Card>

      <section aria-labelledby="lessons-heading" className="mb-8 flex flex-col gap-4">
        <h2 id="lessons-heading" className="text-xl font-bold">
          Lessons
        </h2>
        {data.modules.length === 0 ? (
          <EmptyState title="No lessons published yet" description="Lessons for this course will appear here." />
        ) : (
          data.modules.map((m) => <ModuleSection key={m.id} module={m} />)
        )}
      </section>

      <section aria-labelledby="assessments-heading" className="flex flex-col gap-6">
        <h2 id="assessments-heading" className="text-xl font-bold">
          Assessments
        </h2>
        {data.assessments.length === 0 ? (
          <EmptyState title="No assessments yet" description="Review, practice and mock exams will appear here." />
        ) : (
          GROUPS.map((g) => {
            const items = data.assessments.filter((a) => a.kind === g.kind);
            if (items.length === 0) return null;
            return (
              <div key={g.kind} id={g.kind} className="flex scroll-mt-24 flex-col gap-3">
                <div>
                  <h3 className="text-lg font-bold">{g.title}</h3>
                  <p className="text-sm text-ink-muted">{g.description}</p>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {items.map((a) => (
                    <li key={a.assessment_version_id}>
                      <AssessmentCard assessment={a} offeringId={data.offering_id} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}

function ModuleSection({ module }: { module: CourseModule }) {
  const done = module.lessons.filter((l) => l.state === "completed").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">{module.title}</CardTitle>
        <CardDescription>
          {done} of {pluralize(module.lessons.length, "lesson")} completed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col divide-y divide-line">
          {module.lessons.map((l) => (
            <li key={l.lesson_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Link href={`/study/lessons/${l.lesson_id}`} className="font-semibold text-brand-primary hover:underline">
                  {l.title}
                </Link>
                {l.objective ? <p className="text-sm text-ink-muted">{l.objective}</p> : null}
                <p className="inline-flex items-center gap-1 text-sm text-ink-muted">
                  <Clock className="size-3.5" aria-hidden /> {pluralize(l.estimated_minutes, "minute")}
                </p>
              </div>
              <LessonStateBadge state={l.state} />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function xpNote(a: CourseAssessment): string {
  const max = a.kind === "review" ? 20 : a.kind === "practice" ? 50 : 100;
  return `Up to ${max} XP for your best score. Improve your best to earn the difference.`;
}

function AssessmentCard({ assessment: a, offeringId }: { assessment: CourseAssessment; offeringId: string }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle as="h4">{a.title}</CardTitle>
        <CardDescription>
          {pluralize(a.question_count, "question")} · {formatDuration(a.duration_seconds)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 text-sm">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
          <dt className="text-ink-muted">Best score</dt>
          <dd className="font-semibold">{a.best_percent === null ? "No attempts yet" : `${a.best_percent}%`}</dd>
          <dt className="text-ink-muted">Completed</dt>
          <dd className="font-semibold">{pluralize(a.completed_attempts, "attempt")}</dd>
        </dl>
        <p className="text-ink-muted">{xpNote(a)}</p>
        {a.active_attempt_id ? (
          <Badge tone="warning" className="self-start">
            In progress
          </Badge>
        ) : null}
      </CardContent>
      <CardFooter>
        {a.active_attempt_id ? (
          <Button asChild block>
            <Link href={`/attempts/${a.active_attempt_id}`}>
              Resume<span className="sr-only"> {a.title}</span>
            </Link>
          </Button>
        ) : (
          <Button asChild block variant={a.completed_attempts > 0 ? "outline" : "primary"}>
            <Link href={`/study/assessments/${a.assessment_version_id}?offering=${offeringId}`}>
              {a.completed_attempts > 0 ? "Start again" : "Start"}
              <span className="sr-only"> {a.title}</span>
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
