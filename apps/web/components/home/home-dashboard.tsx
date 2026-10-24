import type { HomeSummary } from "@scholau/api";
import { HomeCourseFocus } from "./home-course-focus";

export function HomeDashboard({ summary: s }: { summary: HomeSummary }) {
  const isNew = s.recent_activity.length === 0 && s.enrolled_courses.every((c) => c.lessons_completed === 0);

  return (
    <div className="home-dashboard compact-home home-dashboard-course">
      {isNew && s.welcome_xp_awarded ? (
        <p className="welcome-note">10 welcome XP added.</p>
      ) : null}
      <HomeCourseFocus summary={s} />
    </div>
  );
}
