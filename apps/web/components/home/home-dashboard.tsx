import { BookOpen } from "lucide-react";
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
    <div className="home-welcome"><div><p className="eyebrow hidden lg:block">YOUR LEARNING SPACE</p><h1>{isNew ? "Welcome, " : "Welcome back, "}<span>{s.display_name}</span></h1><p>Keep learning. Build your future.</p></div><StatsPanel summary={s} /></div>
    <div className="home-columns"><div className="home-primary">
      {s.enrolled_courses.length ? <ContinueLearningCard item={s.continue_learning} firstLesson={isNew} course={course} /> : <EmptyState icon={<BookOpen className="size-6" />} title="Your next chapter starts here" description="Choose your semester’s courses and make room for a little progress every day." action={<Button asChild><Link href="/onboarding/courses">Choose courses</Link></Button>} />}
      <QuickActions offeringId={offering} /><div className="lg:hidden"><BattleCard live={s.live_battle} /></div>
      {s.enrolled_courses.length ? <CourseProgressList courses={s.enrolled_courses} /> : null}
      {isNew && s.enrolled_courses.length > 0 ? <HowItWorks /> : null}<RecentActivity items={s.recent_activity} />
    </div><aside aria-label="Battles and daily progress" className="home-secondary"><div className="hidden lg:block"><BattleCard live={s.live_battle} /></div><LearningXpCard today={s.learning_xp_today} cap={s.learning_xp_daily_cap} />
      <div className="study-note"><BookOpen className="size-5 text-brand-primary" aria-hidden /><h2>A little learning goes a long way.</h2><p>Pick up a lesson, test what you know, and come back a little stronger.</p><Link href="/study">Explore your courses <span aria-hidden>→</span></Link></div>
    </aside></div>
  </div>;
}
