"use client";

import { BookOpen, CheckCircle2, ClipboardCheck, Clock, PlayCircle, Swords } from "lucide-react";
import Link from "next/link";
import type { HomeSummary } from "@scholau/api";
import { type ActivityKind, formatRelative, formatXpDelta, pluralize } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";

type Continue = NonNullable<HomeSummary["continue_learning"]>;

export function ContinueLearningCard({ item, firstLesson }: { item: Continue | null; firstLesson: boolean }) {
  if (!item) {
    return (
      <Card tint>
        <CardHeader>
          <CardTitle>You&apos;re all caught up</CardTitle>
          <CardDescription>There are no unfinished lessons in your courses right now.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href="/study">Go to Study</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }
  return (
    <Card tint>
      <CardHeader>
        <p className="text-sm font-semibold text-brand-primary">{item.course_title}</p>
        <CardTitle>{firstLesson ? "Start your first lesson" : "Continue learning"}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-lg font-semibold text-ink">{item.title}</p>
        <p className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
          <Clock className="size-4" aria-hidden />
          About {pluralize(item.estimated_minutes, "minute")}
          {item.kind === "resume" ? " · In progress" : null}
        </p>
      </CardContent>
      <CardFooter>
        <Button asChild>
          <Link href={`/study/lessons/${item.lesson_id}`}>
            <PlayCircle className="size-5" aria-hidden />
            {firstLesson ? "Start lesson" : item.kind === "resume" ? "Resume lesson" : "Start next lesson"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function HowItWorks() {
  const items = [
    { icon: BookOpen, title: "Review", body: "Check your understanding after a lesson with instant feedback on each question." },
    { icon: ClipboardCheck, title: "Practice", body: "Practice sets and mock exams help you prepare for tests." },
    { icon: Swords, title: "Battles", body: "Quick 1v1 quiz battles on your courses. Every completed battle earns XP." },
  ];
  return (
    <section aria-labelledby="how-title" className="flex flex-col gap-3">
      <h2 id="how-title" className="text-lg font-bold">
        How ScholAu works
      </h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {items.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex flex-col gap-1 rounded-control border border-line bg-surface-card p-4">
            <span className="inline-flex items-center gap-2 font-semibold text-ink">
              <Icon className="size-5 text-brand-primary" aria-hidden />
              {title}
            </span>
            <span className="text-sm text-ink-muted">{body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CourseProgressList({ courses }: { courses: HomeSummary["enrolled_courses"] }) {
  return (
    <section aria-labelledby="courses-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="courses-title" className="text-lg font-bold">
          Your courses
        </h2>
        <Link href="/onboarding/courses" className="text-sm font-semibold text-brand-primary underline-offset-4 hover:underline">
          Add courses
        </Link>
      </div>
      <ul className="flex flex-col gap-3">
        {courses.map((c) => {
          const percent = c.lessons_total > 0 ? (100 * c.lessons_completed) / c.lessons_total : 0;
          return (
            <li key={c.offering_id}>
              <Link
                href={`/study/courses/${c.offering_id}`}
                className="flex flex-col gap-2 rounded-card border border-line bg-surface-card p-4 shadow-card hover:border-line-strong"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="min-w-0">
                    <span className="font-bold text-ink">{c.code}</span> <span className="text-ink">{c.title}</span>
                  </span>
                  <span className="text-sm text-ink-muted">
                    {c.lessons_completed} of {pluralize(c.lessons_total, "lesson")}
                  </span>
                </span>
                <Progress value={percent} label={`${c.code} progress`} tone={percent >= 100 ? "success" : "brand"} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const ACTIVITY: Record<ActivityKind, { label: string; icon: typeof BookOpen }> = {
  lesson_completed: { label: "Lesson completed", icon: BookOpen },
  assessment_completed: { label: "Assessment completed", icon: ClipboardCheck },
  battle_completed: { label: "Battle completed", icon: Swords },
};

export function RecentActivity({ items }: { items: HomeSummary["recent_activity"] }) {
  return (
    <section aria-labelledby="activity-title" className="flex flex-col gap-3">
      <h2 id="activity-title" className="text-lg font-bold">
        Recent activity
      </h2>
      {items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="size-6" />}
          title="No activity yet"
          description="Completed lessons, assessments and battles will appear here."
        />
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface-card">
          {items.map((a) => {
            const { label, icon: Icon } = ACTIVITY[a.kind];
            return (
              <li key={`${a.kind}-${a.source_id}`} className="flex items-center gap-3 px-4 py-3">
                <Icon className="size-5 shrink-0 text-brand-primary" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{label}</span>
                  <time dateTime={a.created_at} className="text-sm text-ink-muted">
                    {formatRelative(a.created_at)}
                  </time>
                </span>
                <span className="text-sm font-semibold text-ink">{formatXpDelta(a.xp)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
