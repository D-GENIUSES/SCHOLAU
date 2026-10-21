import { ProfileView } from "@/components/profile/profile-view";
import { PublicProfilePreview } from "@/components/profile/public-profile-preview";
import { AnswerOptionsPreview } from "@/components/battle/answer-options-preview";
import { ArenaPreview } from "@/components/battle/arena-preview";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { HomeSummary } from "@scholau/api";
import { FirstLessonPreview } from "@/components/lesson/first-lesson-preview";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { ShellFrame } from "@/components/shell/shell-frame";
import { LeaderboardPreview } from "@/components/leaderboard/leaderboard-preview";
import { LessonListPreview } from "@/components/lesson/lesson-list-preview";

export default async function DesignPreview({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { state = "returning" } = await searchParams;
  if (state === "public-profile") return <PublicProfilePreview />;
  if (state === "leaderboard") return <ShellFrame pathname="/leaderboard" displayName="Learner"><LeaderboardPreview /></ShellFrame>;
  if (state === "lessons") return <ShellFrame pathname="/study" displayName="Learner"><LessonListPreview /></ShellFrame>;
  if (state === "profile") return <ShellFrame pathname="/profile" displayName="John Nwaokolo"><ProfileView email="learner@example.com" /></ShellFrame>;
  if (state === "streak") return <FirstLessonPreview />;
  if (state === "battle-options") return <AnswerOptionsPreview />;
  if (state === "battle-arena") return <ArenaPreview />;
  const now = new Date();
  const summary: HomeSummary = {
    server_time: now.toISOString(), display_name: "Learner", needs_onboarding: false, xp_total: 1040,
    learning_xp_today: 28, learning_xp_daily_cap: null, premium: false,
    streak: { current: 7, longest: 7, active_today: true, local_date: now.toISOString().slice(0, 10) },
    continue_learning: { kind: "resume", lesson_id: "preview-lesson", lesson_version_id: "preview-version", title: "Discovering the world around us", estimated_minutes: 5, course_id: "preview-course", course_title: "General Knowledge", offering_id: "preview-offering" },
    enrolled_courses: [
      { offering_id: "preview-offering", course_id: "preview-course", code: "GENERAL", title: "General Knowledge", lessons_total: 12, lessons_completed: 8 },
      { offering_id: "preview-offering-2", course_id: "preview-course-2", code: "NUMBERS", title: "Everyday Numbers", lessons_total: 12, lessons_completed: 4 },
      { offering_id: "preview-offering-3", course_id: "preview-course-3", code: "WORLD", title: "Our World", lessons_total: 10, lessons_completed: 0 },
    ],
    recent_activity: [{ kind: "lesson_completed", source_id: "sample-1", local_date: now.toISOString().slice(0, 10), created_at: new Date(now.getTime() - 7200000).toISOString(), xp: 20 }, { kind: "battle_completed", source_id: "sample-2", local_date: now.toISOString().slice(0, 10), created_at: new Date(now.getTime() - 18000000).toISOString(), xp: 15 }],
    live_battle: null, unread_notifications: 2,
  };
  if (state === "new") { summary.xp_total = 10; summary.welcome_xp_awarded = true; summary.streak.current = 0; summary.recent_activity = []; summary.enrolled_courses = summary.enrolled_courses.map((c) => ({ ...c, lessons_completed: 0 })); }
  if (state === "empty") { summary.enrolled_courses = []; summary.continue_learning = null; summary.recent_activity = []; }
  if (state === "complete") summary.continue_learning = null;
  if (state === "live") summary.live_battle = { battle_id: "preview-battle", queue_id: null, expires_at: new Date(now.getTime() + 120000).toISOString() };
  return <ShellFrame displayName="Learner" unread={2}><div className="mb-6 rounded-card border border-line bg-white p-4 text-xs text-ink-muted"><p className="mb-2">Development design preview · sample data · account actions require sign-in.</p><nav aria-label="Preview state" className="flex flex-wrap gap-4">{["returning", "new", "empty", "complete", "live"].map((s) => <Link key={s} href={`/design-preview?state=${s}`} aria-current={s === state ? "page" : undefined} className="text-brand-primary underline">{s}</Link>)}</nav></div><HomeDashboard summary={summary} /></ShellFrame>;
}
