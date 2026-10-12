"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { useHomeSummary } from "@scholau/api/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { ContinueLearningCard, CourseProgressList, HowItWorks, RecentActivity } from "./learning-panels";
import { BattleCard, LearningXpCard, StatsPanel } from "./side-panels";

export function HomeView() {
  const home = useHomeSummary();

  if (home.isPending) return <LoadingState label="Loading your home page…" lines={4} />;
  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;

  const s = home.data;
  const hasCourses = s.enrolled_courses.length > 0;
  const isNew = s.recent_activity.length === 0 && s.enrolled_courses.every((c) => c.lessons_completed === 0);

  return (
    <>
      <PageHeader title={`Hello, ${s.display_name}`} description={isNew ? "Welcome to ScholAu. Here's where to start." : "Here's where you left off."} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {hasCourses ? (
            <>
              <ContinueLearningCard item={s.continue_learning} firstLesson={isNew} />
              {isNew ? <HowItWorks /> : null}
              <CourseProgressList courses={s.enrolled_courses} />
            </>
          ) : (
            <EmptyState
              icon={<BookOpen className="size-6" />}
              title="You're not enrolled in any courses yet"
              description="Choose the courses you're taking this semester to start learning."
              action={
                <Button asChild>
                  <Link href="/onboarding/courses">Choose courses</Link>
                </Button>
              }
            />
          )}
          <RecentActivity items={s.recent_activity} />
        </div>
        <aside aria-label="Progress and battles" className="flex flex-col gap-6">
          <StatsPanel summary={s} />
          <LearningXpCard today={s.learning_xp_today} cap={s.learning_xp_daily_cap} />
          <BattleCard live={s.live_battle} />
        </aside>
      </div>
    </>
  );
}
