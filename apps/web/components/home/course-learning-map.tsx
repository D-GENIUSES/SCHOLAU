"use client";

import Link from "next/link";
import { Check, ChevronRight, Clock } from "lucide-react";
import type { CourseModule, CourseOverview } from "@scholau/api";
import { pluralize } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { Progress } from "@/components/ui/misc";

function ModuleTrack({
  module,
  moduleIndex,
  continueLessonId,
}: {
  module: CourseModule;
  moduleIndex: number;
  continueLessonId: string | null;
}) {
  const done = module.lessons.filter((l) => l.state === "completed").length;
  return (
    <section className="home-map-module" aria-labelledby={`module-${module.id}`}>
      <header className="home-map-module-head">
        <p className="home-map-module-index">Topic {moduleIndex + 1}</p>
        <h3 id={`module-${module.id}`}>{module.title}</h3>
        <p className="home-map-module-meta">
          {done}/{module.lessons.length} complete
        </p>
      </header>
      <ol className="home-map-track">
        {module.lessons.map((lesson) => {
          const isContinue = continueLessonId === lesson.lesson_id;
          const state = lesson.state;
          return (
            <li key={lesson.lesson_id}>
              <Link
                href={`/study/lessons/${lesson.lesson_id}`}
                className="home-map-node"
                data-state={state}
                data-continue={isContinue || undefined}
              >
                <span className="home-map-node-marker" data-state={state} aria-hidden>
                  {state === "completed" ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
                <span className="home-map-node-body">
                  <span className="home-map-node-title">{lesson.title}</span>
                  <span className="home-map-node-meta">
                    <Clock className="size-3" aria-hidden /> {lesson.estimated_minutes} min
                    {isContinue ? <span className="home-map-continue-tag">Continue</span> : null}
                  </span>
                </span>
                <ChevronRight className="home-map-node-chevron size-4" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function CourseLearningMap({
  overview,
  continueLessonId,
  loading,
}: {
  overview: CourseOverview | null;
  continueLessonId: string | null;
  loading?: boolean;
}) {
  if (loading) return <LoadingState variant="course" label="Loading course map…" lines={5} />;
  if (!overview) return null;

  const { progress, modules } = overview;
  if (progress.lessons_total === 0 || modules.length === 0) {
    return (
      <EmptyState
        title="Content coming soon"
        description="Published lessons for this course will appear on your map when they are ready."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={`/study/courses/${overview.offering_id}`}>Course details</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="home-course-map">
      <div className="home-map-summary">
        <div className="home-map-summary-row">
          <p className="home-map-summary-label">Course progress</p>
          <p className="home-map-summary-value">
            {progress.lessons_completed}/{progress.lessons_total} · <strong>{progress.percent}%</strong>
          </p>
        </div>
        <Progress value={progress.percent} label="Course lesson progress" tone={progress.percent >= 100 ? "success" : "brand"} className="h-1.5" />
      </div>
      {modules.map((module, index) => (
        <ModuleTrack key={module.id} module={module} moduleIndex={index} continueLessonId={continueLessonId} />
      ))}
      {overview.assessments.length > 0 ? (
        <footer className="home-map-footer">
          <p>{pluralize(overview.assessments.length, "assessment")} · review, practice & mock exams</p>
          <Link href={`/study/courses/${overview.offering_id}#practice`} className="home-map-footer-link">
            Open assessments <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </footer>
      ) : null}
    </div>
  );
}
