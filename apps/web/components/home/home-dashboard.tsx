import type { HomeSummary } from "@scholau/api";
import { HomeCourseFocus } from "./home-course-focus";

export function HomeDashboard({ summary: s }: { summary: HomeSummary }) {
  const name = s.display_name?.trim() || "Learner";

  return (
    <div className="home-dashboard compact-home home-dashboard-course">
      <header className="home-welcome home-welcome-compact home-welcome-panel">
        <div>
          <h1>
            Hi, <span>{name}</span>
          </h1>
        </div>
      </header>
      <HomeCourseFocus summary={s} />
    </div>
  );
}
