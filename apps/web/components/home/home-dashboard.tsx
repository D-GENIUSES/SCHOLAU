import Link from "next/link";
import type { HomeSummary } from "@scholau/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { ContinueLearningCard, CourseProgressList, HowItWorks, QuickActions, RecentActivity } from "./learning-panels";
import { BattleCard, LearningXpCard, StatsPanel } from "./side-panels";
export function HomeDashboard({ summary: s }: { summary: HomeSummary }) {
  const isNew = s.recent_activity.length === 0 && s.enrolled_courses.every((c) => c.lessons_completed === 0);
  const course = s.enrolled_courses.find((c) => c.offering_id === s.continue_learning?.offering_id);
  const offering = course?.offering_id ?? s.enrolled_courses[0]?.offering_id;
  return <div className="home-dashboard">
    <div className="home-welcome"><div><h1>{isNew ? "Welcome, " : "Welcome back, "}<span>{s.display_name}</span></h1><p>Your lessons, tests, and quiz battles.</p></div><StatsPanel summary={s} /></div>
    {isNew && s.welcome_xp_awarded ? <section aria-label="Welcome XP" className="rounded-card border border-line bg-surface-tint p-4">
      <h2 className="font-bold">10 welcome XP added</h2>
      <p className="mt-1 text-sm text-ink-muted">Complete knowledge checks and assessments to earn more XP.</p>
      <Button asChild size="sm" className="mt-3"><Link href="/leaderboard">See your rank</Link></Button>
    </section> : null}
    <div className="home-columns"><div className="home-primary">
      {s.enrolled_courses.length ? <ContinueLearningCard item={s.continue_learning} firstLesson={isNew} course={course} /> : <EmptyState title="No courses assigned yet" description="Courses are assigned from your saved academic profile when they become available. Check your assignments or complete your setup." action={<Button asChild><Link href="/onboarding/courses">View course assignments</Link></Button>} />}
      <QuickActions offeringId={offering} /><div className="lg:hidden"><BattleCard live={s.live_battle} /></div>
      {s.enrolled_courses.length ? <CourseProgressList courses={s.enrolled_courses} /> : null}
      {isNew && s.enrolled_courses.length > 0 ? <HowItWorks /> : null}<RecentActivity items={s.recent_activity} />
    </div><aside aria-label="Battles and daily progress" className="home-secondary"><div className="hidden lg:block"><BattleCard live={s.live_battle} /></div><LearningXpCard today={s.learning_xp_today} cap={s.learning_xp_daily_cap} />

    </aside></div>
  </div>;
}
