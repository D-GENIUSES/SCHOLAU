"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const coursePages = [
  { page: "content", label: "Content" },
  { page: "quizzes", label: "Quizzes" },
  { page: "challenges", label: "Challenges" },
  { page: "assignments", label: "Assignments" },
  { page: "students", label: "Students" },
  { page: "heatmap", label: "Insights" },
];

export function CourseNavigation({ offeringId }: { offeringId: string }) {
  const base = `/lecturer/courses/${offeringId}`;
  const pathname = usePathname();
  const section = pathname.slice(base.length).split("/")[1];

  return (
    <nav aria-label="Course sections" className="lecturer-course-tabs">
      {coursePages.map(({ page, label }) => {
        const active = section === page;
        return (
          <Link
            key={page}
            href={`${base}/${page}`}
            aria-current={active ? "location" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center border-b-2 px-0.5 text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary",
              active ? "border-brand-primary text-brand-primary" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
