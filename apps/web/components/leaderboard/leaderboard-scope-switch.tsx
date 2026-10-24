"use client";

import type { ReactNode } from "react";
import { GraduationCap, Globe2 } from "lucide-react";
import type { LeaderboardScope } from "@scholau/core";
import { Segmented } from "@/components/ui/segmented";

const SCOPE_OPTIONS = [
  { value: "global", label: "Global", icon: <Globe2 className="size-4" strokeWidth={2.25} /> },
  { value: "faculty", label: "Faculty", icon: <GraduationCap className="size-4" strokeWidth={2.25} /> },
] as const satisfies readonly { value: LeaderboardScope; label: string; icon: ReactNode }[];

export function LeaderboardScopeSwitch({
  scope,
  onScopeChange,
}: {
  scope: LeaderboardScope;
  onScopeChange: (scope: LeaderboardScope) => void;
}) {
  return (
    <div className="leaderboard-scope-bar">
      <p id="leaderboard-scope-label" className="leaderboard-scope-label">
        Ranking
      </p>
      <Segmented
        name="leaderboard-scope"
        legend="Leaderboard scope"
        value={scope}
        onChange={onScopeChange}
        options={SCOPE_OPTIONS}
        equalWidth
      />
    </div>
  );
}
