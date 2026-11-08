import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import type { LecturerOffering } from "@scholau/core";
import { EmptyState } from "@/components/ui/states";
import { CreateQuizAction } from "./create-quiz-action";
import { CourseQuickActions } from "./course-quick-actions";
import { LecturerQuizAttention } from "./lecturer-quiz-attention";
import { QuizAttentionBoundary } from "./quiz-attention-boundary";

const row = "flex min-w-0 items-center gap-3 px-4 py-4 hover:bg-surface-tint focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary sm:px-5";

export function LecturerDashboard({ courses, pendingSubmissions }: {
  courses: LecturerOffering[];
  pendingSubmissions: number;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-8 sm:space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">My courses</h1>
          <p className="mt-1.5 text-sm text-ink-muted sm:text-base">Manage your teaching courses.</p>
        </div>
        {courses.length ? <CreateQuizAction courses={courses} /> : null}
      </header>

      {courses.length ? (
        <ul aria-label="Assigned courses" className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-card">
          {courses.map((course) => (
            <li key={course.id}>
              <div className={`${row.replace("hover:bg-surface-tint", "")} flex-col items-stretch sm:flex-row`}>
                <Link href={`/lecturer/courses/${course.id}/content`} className="flex min-w-0 flex-1 items-center gap-3 focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary">
                  <div className="min-w-0 flex-1 wrap-break-word">
                    <p className="font-bold sm:text-lg">{course.code}</p>
                    <p className="text-sm leading-snug text-ink">{course.title}</p>
                    <p className="mt-1 text-xs text-ink-muted">{course.department} · {course.period}</p>
                    <p className="mt-1 text-xs text-ink-muted min-[420px]:hidden">{course.semester}</p>
                  </div>
                  <p className="hidden max-w-32 shrink-0 text-right text-sm text-ink-muted min-[420px]:block">{course.semester}</p>
                  <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
                </Link>
                <CourseQuickActions offeringId={course.id} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No teaching courses assigned yet" description="Your courses will appear here once an administrator assigns them to you." />
      )}

      <QuizAttentionBoundary>
        <LecturerQuizAttention courses={courses} />
      </QuizAttentionBoundary>
      {pendingSubmissions > 0 ? (
        <section aria-labelledby="lecturer-needs-attention" className="space-y-3">
          <h2 id="lecturer-needs-attention" className="text-xl font-bold tracking-tight sm:text-2xl">Needs attention</h2>
          <Link href="/lecturer/submissions" className={`${row} min-h-16 rounded-card border border-line bg-surface-card`}>
            <FileText className="size-5 shrink-0 text-ink-muted" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
              <span className="text-sm font-semibold sm:text-base">Student submissions</span>
              <span className="text-xs text-ink-muted sm:text-sm">{pendingSubmissions} awaiting review</span>
            </div>
            <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
          </Link>
        </section>
      ) : null}
    </div>
  );
}
