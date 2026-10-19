import Link from "next/link";
import { BookOpen, ClipboardCheck, Swords, Trophy } from "lucide-react";
import type { HomeSummary } from "@scholau/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { ContinueLearningCard, CourseProgressList } from "./learning-panels";
import { StatsPanel, LearningXpCard } from "./side-panels";
export function HomeDashboard({ summary: s }: { summary: HomeSummary }) {
  const isNew = s.recent_activity.length === 0 && s.enrolled_courses.every((c) => c.lessons_completed === 0);
  const course = s.enrolled_courses.find((c) => c.offering_id === s.continue_learning?.offering_id);
  const offering = course?.offering_id ?? s.enrolled_courses[0]?.offering_id;
  const live = s.live_battle;
  const actions = [
    { label: "My courses", detail: `${s.enrolled_courses.length} courses`, href: "/study", icon: BookOpen },
    { label: "Practice", detail: "Tests & mock exams", href: offering ? `/study/courses/${offering}#practice` : "/study", icon: ClipboardCheck },
    { label: live ? "Resume battle" : "Quiz battles", detail: "Challenge a learner", href: live?.battle_id ? `/battles/${live.battle_id}` : live?.queue_id ? "/battles/queue" : "/battles", icon: Swords },
    { label: "Leaderboard", detail: "See your rank", href: "/leaderboard", icon: Trophy },
  ];
  return <div className="home-dashboard compact-home">
    <div className="home-welcome"><div><h1>{isNew ? "Welcome, " : "Welcome back, "}<span>{s.display_name}</span></h1></div><StatsPanel summary={s} /></div>
    {isNew && s.welcome_xp_awarded ? <p className="welcome-note">10 welcome XP added · Your learning journey starts here.</p> : null}
    <div className="compact-home-grid">
      <div className="compact-home-main">
        {s.enrolled_courses.length ? <ContinueLearningCard item={s.continue_learning} firstLesson={isNew} course={course} /> : <EmptyState title="Your courses" description="Complete your academic profile to find your courses." action={<Button asChild><Link href="/onboarding/courses">View assignments</Link></Button>} />}
        <nav className="home-action-grid" aria-label="Learning shortcuts">{actions.map(({ label, detail, href, icon: Icon }) => <Link key={label} href={href} className="home-action-tile"><span className="tile-icon"><Icon aria-hidden size={23} strokeWidth={2} /></span><span><strong>{label}</strong><small>{detail}</small></span></Link>)}</nav>
      </div>
      <aside className="compact-home-aside" aria-label="Courses and daily progress">
        {s.enrolled_courses.length ? <CourseProgressList courses={s.enrolled_courses} /> : null}
        <LearningXpCard today={s.learning_xp_today} cap={s.learning_xp_daily_cap} />
      </aside>
    </div>
  </div>;
}
