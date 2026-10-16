import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { HomeSummary } from "@scholau/api";
import { type ActivityKind, formatRelative, formatXpDelta, pluralize } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";

type Continue = NonNullable<HomeSummary["continue_learning"]>;
type Course = HomeSummary["enrolled_courses"][number];

export function ContinueLearningCard({ item, firstLesson, course, href, preview = false }: {
  item: Continue | null;
  firstLesson: boolean;
  course?: Course;
  href?: string;
  preview?: boolean;
}) {
  const percent = course && course.lessons_total > 0
    ? Math.round(100 * course.lessons_completed / course.lessons_total)
    : null;
  return (
    <section className="learning-spotlight" aria-labelledby="continue-title">
      <div className="spotlight-content">
        <p className="content-label">{preview ? "Free sample lesson" : firstLesson ? "First lesson" : item ? "Continue learning" : "Lessons completed"}</p>
        <h2 id="continue-title">{item?.course_title ?? "No remaining lessons"}</h2>
        <p className="spotlight-description">{item?.title ?? "Choose another course or take a practice test."}</p>
        {percent !== null && course ? (
          <div className="spotlight-progress">
            <div className="flex items-center gap-3">
              <Progress value={percent} label={`${course.title} progress`} />
              <span className="text-sm font-semibold">{percent}%</span>
            </div>
            <p>{course.lessons_completed} of {pluralize(course.lessons_total, "lesson")} completed</p>
          </div>
        ) : item ? (
          <p className="spotlight-time">{pluralize(item.estimated_minutes, "minute")}{preview ? " · No account needed" : item.kind === "resume" ? " · In progress" : ""}</p>
        ) : null}
        <Button asChild className="self-start">
          <Link href={href ?? (item ? `/study/lessons/${item.lesson_id}` : "/study")}>
            {preview ? "Start learning" : !item ? "Go to Study" : firstLesson ? "Start lesson" : item.kind === "resume" ? "Continue lesson" : "Start next lesson"}
          </Link>
        </Button>
      </div>
    </section>
  );
}

export function QuickActions({ offeringId, guest = false }: { offeringId?: string; guest?: boolean }) {
  const base = offeringId ? `/study/courses/${offeringId}` : "/study";
  const actions = [
    { label: "Practice test", description: "Questions with feedback", href: guest ? "/home?view=practice" : `${base}${offeringId ? "#practice" : ""}` },
    { label: "Mock exam", description: "Timed assessment", href: guest ? "/home?view=mock" : `${base}${offeringId ? "#mock" : ""}` },
  ];
  return (
    <section aria-labelledby="quick-title">
      <h2 id="quick-title" className="section-title">Practice</h2>
      <div className="quick-actions">
        {actions.map(({ label, description, href }) => (
          <Link key={label} href={href} className="quick-action">
            <span><strong>{label}</strong><small>{description}</small></span>
            <ChevronRight className="size-4 action-chevron" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks({ guest = false }: { guest?: boolean }) {
  const items = [
    { title: "Study", body: guest ? "Read sample lessons in general knowledge." : "Read lessons in your selected courses." },
    { title: "Practice", body: "Answer practice questions or take a timed mock exam." },
    { title: "Battles", body: "Play 1v1 quizzes and earn XP for completed matches." },
  ];
  return (
    <section aria-labelledby="how-title">
      <h2 id="how-title" className="section-title">Using ScholAu</h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {items.map(({ title, body }) => <li key={title} className="how-card"><h3>{title}</h3><p>{body}</p></li>)}
      </ul>
    </section>
  );
}

export function CourseProgressList({ courses }: { courses: HomeSummary["enrolled_courses"] }) {
  return (
    <section aria-labelledby="courses-title">
      <div className="section-heading"><h2 id="courses-title">Your courses</h2><Link href="/study">View all <ChevronRight className="size-4" aria-hidden /></Link></div>
      <ul className="course-list enrolled-course-grid">
        {courses.slice(0, 4).map((course) => {
          const percent = course.lessons_total > 0 ? Math.round(100 * course.lessons_completed / course.lessons_total) : 0;
          return (
            <li key={course.offering_id}>
              <Link href={`/study/courses/${course.offering_id}`} className="course-row">
                <span className="course-info">
                  <strong>{course.title}</strong>
                  <small>{course.code} · {course.lessons_completed} of {pluralize(course.lessons_total, "lesson")}</small>
                  <span className="flex items-center gap-3">
                    <Progress value={percent} label={`${course.code} progress`} tone={percent >= 100 ? "success" : "brand"} className="h-1.5" />
                    <span className="text-xs text-ink-muted">{percent}%</span>
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  lesson_completed: "Lesson completed",
  assessment_completed: "Assessment completed",
  battle_completed: "Battle completed",
};

export function RecentActivity({ items }: { items: HomeSummary["recent_activity"] }) {
  return (
    <section aria-labelledby="activity-title">
      <h2 id="activity-title" className="section-title">Recent activity</h2>
      {items.length === 0 ? (
        <EmptyState title="No activity yet" description="Completed lessons, tests, and battles will appear here." />
      ) : (
        <ul className="activity-list">
          {items.map((activity) => (
            <li key={`${activity.kind}-${activity.source_id}`}>
              <span className="min-w-0 flex-1"><strong>{ACTIVITY_LABELS[activity.kind]}</strong><time dateTime={activity.created_at}>{formatRelative(activity.created_at)}</time></span>
              <span className="activity-xp">{formatXpDelta(activity.xp)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
