"use client";

import { Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { isApiError } from "@scholau/api";
import { useLeaderboard } from "@scholau/api/react";
import { formatDateTime, type LeaderboardScope } from "@scholau/core";
import { LeaderboardList } from "@/components/leaderboard/leaderboard-list";
import { MyPositionCard } from "@/components/leaderboard/my-position-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";

const SCOPES = [
  { value: "faculty", label: "Faculty" },
  { value: "global", label: "Global" },
] as const satisfies readonly { value: LeaderboardScope; label: string }[];

export default function LeaderboardPage() {
  const [scope, setScope] = useState<LeaderboardScope>("global");
  const scopeLabel = scope === "faculty" ? "Faculty" : "Global";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Leaderboard"
        title="Leaderboard"
        description="Ranked by lifetime XP. Players with the same XP share a rank."
      />
      <Segmented name="leaderboard-scope" legend="Leaderboard scope" value={scope} onChange={setScope} options={SCOPES} />
      <ScopeBoard key={scope} scope={scope} scopeLabel={scopeLabel} />
    </div>
  );
}

function ScopeBoard({ scope, scopeLabel }: { scope: LeaderboardScope; scopeLabel: string }) {
  const board = useLeaderboard(scope);
  const pages = board.data?.pages ?? [];
  const first = pages[0];
  const rows = pages.flatMap((p) => p.rows);

  if (board.isPending) return <LoadingState label="Loading leaderboard…" />;

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
    <section aria-labelledby="leaderboard-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="leaderboard-heading" className="text-xl font-bold">
          {scopeLabel} ranking
        </h2>
        <p className="text-sm text-ink-muted">As of {formatDateTime(first.as_of)}</p>
      </div>
      <MyPositionCard me={first.me} scopeLabel={scopeLabel} />
      {rows.length === 0 ? (
        <EmptyState
          icon={<Trophy className="size-6" />}
          title="No rankings yet"
          description="Complete lessons, assessments and battles to earn XP and appear here."
        />
      ) : (
        <>
          <LeaderboardList rows={rows} label={`${scopeLabel} leaderboard`} />
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
