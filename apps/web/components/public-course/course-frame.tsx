import type { ReactNode } from "react";
import Link from "next/link";
import { ShellFrame } from "@/components/shell/shell-frame";

export function CourseFrame({ children }: { children: ReactNode }) {
  return <ShellFrame guest pathname="/home">{children}</ShellFrame>;
}

export function CourseCrumb({ course, topic, lesson }: { course: { slug: string; code: string }; topic?: { slug: string; title: string }; lesson?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm">
      <Link href="/courses">Courses</Link>
      {" / "}
      <Link href={`/courses/${course.slug}`}>{course.code}</Link>
      {topic ? <>{" / "}<Link href={`/courses/${course.slug}/${topic.slug}`}>{topic.title}</Link></> : null}
      {lesson ? <>{" / "}<span aria-current="page">{lesson}</span></> : null}
    </nav>
  );
}

export function EditorialNote({ status }: { status?: "corrected" | "flagged" | null }) {
  if (status === "corrected") return <p className="text-sm text-ink-muted">Source note: corrected against the supplied pages.</p>;
  if (status === "flagged") return <p className="text-sm text-ink-muted">Source note: flagged. Uncertain or incomplete source text was not invented.</p>;
  return null;
}
