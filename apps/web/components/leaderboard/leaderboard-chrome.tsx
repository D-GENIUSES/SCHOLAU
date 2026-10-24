"use client";

import type { LeaderboardScope } from "@scholau/core";
import { PageHeader } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";

const SCOPES = [
  { value: "faculty", label: "Faculty" },
  { value: "global", label: "Global" },
] as const satisfies readonly { value: LeaderboardScope; label: string }[];

export function LeaderboardChrome({
  scope,
  onScopeChange,
}: {
  scope: LeaderboardScope;
  onScopeChange: (scope: LeaderboardScope) => void;
}) {
  return (
    <div className="leaderboard-chrome">
      <PageHeader
        title="Leaderboard"
        description="Lifetime XP · equal points, earlier signup wins."
        actions={
          <Segmented
            name="leaderboard-scope"
            legend="Leaderboard scope"
            value={scope}
            onChange={onScopeChange}
            options={SCOPES}
          />
        }
      />
    </div>
  );
}

export { SCOPES as LEADERBOARD_SCOPES };
