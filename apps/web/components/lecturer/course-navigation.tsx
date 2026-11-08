"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const assessmentPages = [
  { page: "quizzes", label: "Quizzes" },
  { page: "challenges", label: "Challenges" },
  { page: "assignments", label: "Assignments" },
];
const coursePages = [
  { page: "content", label: "Content" },
  { page: "quizzes", label: "Assessments" },
  { page: "students", label: "Students" },
  { page: "heatmap", label: "Insights" },
];

export function CourseNavigation({ offeringId }: { offeringId: string }) {
  const base = `/lecturer/courses/${offeringId}`;
  const pathname = usePathname();
  const section = pathname.slice(base.length).split("/")[1];
  const inAssessments = assessmentPages.some(({ page }) => page === section);

  return (
    <>
      <nav aria-label="Course sections" className="flex flex-wrap gap-x-4 border-b border-line sm:gap-x-7">
        {coursePages.map(({ page, label }) => {
          const active = page === "quizzes" ? inAssessments : section === page;
          return (
            <Link key={page} href={`${base}/${page}`} aria-current={active ? "location" : undefined}
              className={cn("inline-flex min-h-11 items-center border-b-2 px-0.5 text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary",
                active ? "border-brand-primary text-brand-primary" : "border-transparent text-ink-muted hover:text-ink")}>
              {label}
            </Link>
          );
        })}
      </nav>
      {inAssessments ? (
        <nav aria-label="Assessment types" className="mt-3 flex flex-wrap gap-1">
          {assessmentPages.map(({ page, label }) => (
            <Link key={page} href={`${base}/${page}`} aria-current={section === page ? "location" : undefined}
              className={cn("inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary",
                section === page ? "bg-surface-tint text-brand-primary" : "text-ink-muted hover:bg-surface-tint hover:text-ink")}>
              {label}
            </Link>
          ))}
        </nav>
      ) : null}
    </>
  );
}
