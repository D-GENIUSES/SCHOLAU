import Link from "next/link";
import type { ReactNode } from "react";
import type { CatalogOffering, Profile } from "@scholau/api";
import { pluralize } from "@scholau/core";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";

export function academicSummary(academic: Profile["academic"] | undefined): string | null {
  if (!academic) return null;
  return [academic.department.name, academic.level.label, academic.semester.label].join(" · ");
}

export function CourseCard({
  offering,
  academic,
  action,
}: {
  offering: CatalogOffering;
  academic: string | null;
  action: ReactNode;
}) {
  const { course, lesson_count, lessons_completed, enrolled } = offering;
  const percent = lesson_count > 0 ? (lessons_completed / lesson_count) * 100 : 0;
  return (
    <Card className="course-study-card flex h-full flex-col">
      <CardHeader>
        <span className="text-sm font-semibold text-brand-primary">{course.code}</span>
        <CardTitle as="h3">
          {enrolled ? (
            <Link href={`/study/courses/${offering.offering_id}`} className="hover:underline">
              {course.title}
            </Link>
          ) : (
            course.title
          )}
        </CardTitle>
        {academic ? <CardDescription>{academic}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        {offering.unit_count != null ? <p className="text-sm text-ink-muted">{pluralize(offering.unit_count, "unit")} · Status {offering.requirement_status}</p> : null}
        {offering.elective_group ? <p className="text-sm font-semibold text-ink-muted">Choose one elective from this group</p> : null}
        {lesson_count === 0 ? <p className="text-sm text-ink-muted">Content coming soon</p> : null}
        {course.description ? <p className="line-clamp-3 text-sm text-ink-muted">{course.description}</p> : null}
        {enrolled ? (
          <div className="mt-auto flex flex-col gap-1">
            <p className="text-sm text-ink-muted">
              {lessons_completed} of {pluralize(lesson_count, "lesson")} completed
            </p>
            <Progress value={percent} label={`${course.code} lesson progress`} tone={percent >= 100 ? "success" : "brand"} className="h-1.5" />
          </div>
        ) : (
          <p className="mt-auto text-sm text-ink-muted">{pluralize(lesson_count, "lesson")}</p>
        )}
      </CardContent>
      <CardFooter>{action}</CardFooter>
    </Card>
  );
}
