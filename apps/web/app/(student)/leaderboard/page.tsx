"use client";

import Link from "next/link";
import { useState } from "react";
import { isApiError } from "@scholau/api";
import { useLeaderboard } from "@scholau/api/react";
import { formatDateTime, type LeaderboardScope } from "@scholau/core";
import { LeaderboardChrome } from "@/components/leaderboard/leaderboard-chrome";
import { LeaderboardList } from "@/components/leaderboard/leaderboard-list";
import { MyPositionCard } from "@/components/leaderboard/my-position-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";

export default function LeaderboardPage() {
  const [scope, setScope] = useState<LeaderboardScope>("global");
  const scopeLabel = scope === "faculty" ? "Faculty" : "Global";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <LeaderboardChrome scope={scope} onScopeChange={setScope} />
      <ScopeBoard key={scope} scope={scope} scopeLabel={scopeLabel} />
    </div>
  );
}

function ScopeBoard({ scope, scopeLabel }: { scope: LeaderboardScope; scopeLabel: string }) {
  const board = useLeaderboard(scope);
  const pages = board.data?.pages ?? [];
  const first = pages[0];
  const rows = pages.flatMap((p) => p.rows);

  if (board.isPending) return <LoadingState variant="leaderboard" label="Loading leaderboard…" />;

  if (!first) {
    if (isApiError(board.error, "INVALID_PROFILE")) {
      return (
        <Alert
          tone="info"
          title="Set your academic profile to see your faculty ranking"
          action={
            <Button asChild size="sm">
              <Link href="/profile">Go to profile</Link>
            </Button>
          }
        >
          The faculty leaderboard uses the faculty in your academic profile. You can still view the global leaderboard.
        </Alert>
      );
    }
    return <ErrorState error={board.error} onRetry={() => void board.refetch()} />;
  }

  return (
    <section aria-label={`${scopeLabel} leaderboard`} className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <EmptyState
          title="No rankings yet"
          description="Complete lessons, assessments and battles to earn XP and appear here."
        />
      ) : (
        <>
          <LeaderboardList
            rows={rows}
            label={`${scopeLabel} leaderboard`}
            updatedAt={`Updated ${formatDateTime(first.as_of)}`}
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
