import type { HomeSummary } from "@scholau/api";
import { HomeCourseFocus } from "./home-course-focus";
import { StatsPanel } from "./side-panels";

export function HomeDashboard({ summary: s }: { summary: HomeSummary }) {
  const isNew = s.recent_activity.length === 0 && s.enrolled_courses.every((c) => c.lessons_completed === 0);
  const name = s.display_name?.trim() || "Learner";

  return (
    <div className="home-dashboard compact-home home-dashboard-course">
      <header className="home-welcome home-welcome-compact">
        <div>
          <h1>
            Hi, <span>{name}</span>
          </h1>
          {isNew && s.welcome_xp_awarded ? (
            <p className="welcome-note">10 welcome XP added.</p>
          ) : (
            <p>Pick up where you left off in your course map.</p>
          )}
        </div>
        <StatsPanel summary={s} />
      </header>
      <HomeCourseFocus summary={s} />
    </div>
  );
}
