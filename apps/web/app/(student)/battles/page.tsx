"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useHomeSummary, useMyLiveBattle } from "@scholau/api/react";
import { COPY } from "@scholau/core";
import { FriendsPanel } from "@/components/battle/friends-panel";
import { InvitationsPanel } from "@/components/battle/invitations-panel";
import { BattleHistory } from "@/components/battle/battle-history";
import { LiveResumeCard } from "@/components/battle/live-resume-card";
import { BattleRulesCard } from "@/components/battle/rules-card";
import { BattleStartPanel } from "@/components/battle/start-panel";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

export default function BattlesPage() {
  return (
    <div className="battle-lobby flex flex-col gap-4">
      <PageHeader title="Battles" description={COPY.battle.unlimited} />
      <p className="battle-reward-note">{COPY.battle.rewards}</p>
      <Suspense fallback={<LoadingState variant="lobby" label="Loading battles…" />}>
        <Lobby />
      </Suspense>
    </div>
  );
}

function Lobby() {
  const params = useSearchParams();
  const home = useHomeSummary();
  const live = useMyLiveBattle();

  return (
    <div className="battle-lobby-content flex flex-col gap-4">
      <InvitationsPanel />
      {live.data ? <LiveResumeCard live={live.data} /> : null}
      <div className="battle-setup-grid">
        <div className="flex flex-col gap-6">
          {home.isPending ? (
            <LoadingState variant="lobby" label="Loading your courses…" lines={2} />
          ) : home.isError ? (
            <ErrorState error={home.error} onRetry={() => void home.refetch()} />
          ) : home.data.enrolled_courses.length === 0 ? (
            <EmptyState
                title="Enroll in a course to battle"
              description="Battles use questions from your enrolled courses."
              action={
                <Button asChild>
                  <Link href="/study">Browse courses</Link>
                </Button>
              }
            />
          ) : (
            <BattleStartPanel courses={home.data.enrolled_courses} initialOfferingId={params.get("offering")} />
          )}
        </div>
        <BattleRulesCard />
      </div>
      <details className="rounded-xl border border-brand-primary/25 bg-surface-card p-3"><summary className="cursor-pointer text-sm font-semibold text-brand-primary">Friends and requests</summary><div className="pt-3"><FriendsPanel /></div></details>
      <BattleHistory />
    </div>
  );
}
