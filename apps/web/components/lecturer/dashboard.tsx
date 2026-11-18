import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { LecturerOffering } from "@scholau/core";
import { EmptyState } from "@/components/ui/states";
import { CreateQuizAction } from "./create-quiz-action";
import { LecturerPageHeader } from "./page-header";
import { LecturerQuizAttention } from "./lecturer-quiz-attention";
import { QuizAttentionBoundary } from "./quiz-attention-boundary";

const row = "flex min-w-0 items-center gap-3 px-3.5 py-3 hover:bg-surface-tint focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary sm:px-4";

export function LecturerDashboard({ courses }: {
  courses: LecturerOffering[];
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <LecturerPageHeader
        title="My courses"
        description="Manage your teaching courses."
        actions={courses.length ? <CreateQuizAction courses={courses} /> : undefined}
      />

      {courses.length ? (
        <ul aria-label="Assigned courses" className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-card">
          {courses.map((course) => (
            <li key={course.id}>
              <Link href={`/lecturer/courses/${course.id}/content`} className={row}>
                <div className="min-w-0 flex-1 wrap-break-word">
                  <p className="text-sm font-bold sm:text-base">{course.code}</p>
                  <p className="text-sm leading-snug text-ink">{course.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{course.department} · {course.period} · {course.semester}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No teaching courses assigned yet" description="Your courses will appear here once an administrator assigns them to you." />
      )}

      <QuizAttentionBoundary>
        <LecturerQuizAttention courses={courses} />
      </QuizAttentionBoundary>
    </div>
  );
}
