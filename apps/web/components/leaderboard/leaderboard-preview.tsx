"use client";

import { useState } from "react";
import type { LeaderboardRow } from "@scholau/api";
import { formatDateTime } from "@scholau/core";
import { LeaderboardChrome } from "./leaderboard-chrome";
import { LeaderboardList } from "./leaderboard-list";
import { MyPositionCard } from "./my-position-card";
import { LeaderboardScopeSwitch } from "./leaderboard-scope-switch";

const rows: LeaderboardRow[] = [
  { rank: 1, user_id: "preview-1", display_name: "campus_scholar", avatar_path: null, xp_total: 1280, is_me: false, faculty_name: "Faculty of Science", level_label: "300 Level" },
  { rank: 2, user_id: "preview-2", display_name: "learning_with_ada", avatar_path: null, xp_total: 1050, is_me: false, faculty_name: "Faculty of Basic Medical Sciences", level_label: "200 Level" },
  { rank: 3, user_id: "preview-3", display_name: "scholau_learner", avatar_path: null, xp_total: 1050, is_me: true, faculty_name: "Faculty of Science", level_label: "200 Level" },
  { rank: 4, user_id: "preview-4", display_name: "engineering_mind", avatar_path: null, xp_total: 820, is_me: false, faculty_name: "Faculty of Engineering", level_label: "400 Level" },
  { rank: 5, user_id: "preview-5", display_name: "a_very_long_student_name", avatar_path: null, xp_total: 820, is_me: false, faculty_name: "Faculty of Business and Social Sciences", level_label: "100 Level" },
  { rank: 6, user_id: "preview-6", display_name: "new_learner", avatar_path: null, xp_total: 10, is_me: false },
];

const asOf = formatDateTime(new Date().toISOString());

export function LeaderboardPreview() {
  const [scope, setScope] = useState<"global" | "faculty">("global");
  const scopeLabel = scope === "faculty" ? "Faculty" : "Global";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <p className="text-xs text-ink-muted">Development preview · compact header layout</p>
      <LeaderboardChrome />
      <LeaderboardList
        rows={rows}
        label={`${scopeLabel} leaderboard`}
        updatedAt={`Updated ${asOf}`}
        scopeBar={<LeaderboardScopeSwitch scope={scope} onScopeChange={setScope} />}
        positionBar={<MyPositionCard me={{ rank: 3, xp_total: 1050 }} scopeLabel={scopeLabel} variant="compact" />}
      />
    </div>
  );
}
