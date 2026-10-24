"use client";

import Link from "next/link";
import { useState } from "react";
import { isApiError } from "@scholau/api";
import { useLeaderboard } from "@scholau/api/react";
import { formatDateTime, type LeaderboardScope } from "@scholau/core";
import { LeaderboardChrome } from "@/components/leaderboard/leaderboard-chrome";
import { LeaderboardList } from "@/components/leaderboard/leaderboard-list";
import { MyPositionCard } from "@/components/leaderboard/my-position-card";
import { LeaderboardScopeSwitch } from "@/components/leaderboard/leaderboard-scope-switch";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";

export default function LeaderboardPage() {
  const [scope, setScope] = useState<LeaderboardScope>("global");
  const scopeLabel = scope === "faculty" ? "Faculty" : "Global";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <LeaderboardChrome />
      <ScopeBoard key={scope} scope={scope} scopeLabel={scopeLabel} onScopeChange={setScope} />
    </div>
  );
}

function ScopeBoard({
  scope,
  scopeLabel,
  onScopeChange,
}: {
  scope: LeaderboardScope;
  scopeLabel: string;
  onScopeChange: (scope: LeaderboardScope) => void;
}) {
  const board = useLeaderboard(scope);
  const pages = board.data?.pages ?? [];
  const first = pages[0];
  const rows = pages.flatMap((p) => p.rows);
  const scopeBar = <LeaderboardScopeSwitch scope={scope} onScopeChange={onScopeChange} />;

  if (board.isPending) {
    return (
      <div className="leaderboard-panel">
        {scopeBar}
        <div className="p-5">
          <LoadingState variant="leaderboard" label="Loading leaderboard…" />
        </div>
      </div>
    );
  }

  if (!first) {
    if (isApiError(board.error, "INVALID_PROFILE")) {
      return (
        <div className="leaderboard-panel">
          {scopeBar}
          <div className="p-4">
            <Alert
              tone="info"
              title="Set your academic profile to see your faculty ranking"
              action={
                <Button asChild size="sm">
                  <Link href="/profile">Go to profile</Link>
                </Button>
              }
            >
              The faculty leaderboard uses the faculty in your academic profile. Switch to Global to see all students.
            </Alert>
          </div>
        </div>
      );
    }
    return (
      <div className="leaderboard-panel">
        {scopeBar}
        <div className="p-4">
          <ErrorState error={board.error} onRetry={() => void board.refetch()} />
        </div>
      </div>
    );
  }

  return (
    <section aria-label={`${scopeLabel} leaderboard`} className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <div className="leaderboard-panel">
          {scopeBar}
          <div className="p-4">
            <EmptyState
              title="No rankings yet"
              description="Complete lessons, assessments and battles to earn XP and appear here."
            />
          </div>
        </div>
      ) : (
        <>
          <LeaderboardList
            rows={rows}
            label={`${scopeLabel} leaderboard`}
            updatedAt={`Updated ${formatDateTime(first.as_of)}`}
            scopeBar={scopeBar}
            positionBar={<MyPositionCard me={first.me} scopeLabel={scopeLabel} variant="compact" />}
          />
          {board.isFetchNextPageError ? <InlineError error={board.error} /> : null}
          {board.hasNextPage ? (
            <Button
              variant="outline"
              className="self-center"
              loading={board.isFetchingNextPage}
              onClick={() => void board.fetchNextPage()}
            >
              Load more
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
