"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useHomeSummary, useMyLiveBattle } from "@scholau/api/react";
import { COPY } from "@scholau/core";
import { BattleHistory } from "@/components/battle/battle-history";
import { LiveResumeCard } from "@/components/battle/live-resume-card";
import { BattleRulesCard } from "@/components/battle/rules-card";
import { BattleStartPanel } from "@/components/battle/start-panel";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

export default function BattlesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Battles" title="1v1 quiz battles" description={COPY.battle.unlimited} />
      <Suspense fallback={<LoadingState label="Loading battles…" />}>
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
    <div className="flex flex-col gap-6">
      {live.data ? <LiveResumeCard live={live.data} /> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-6">
          {home.isPending ? (
            <LoadingState label="Loading your courses…" lines={2} />
          ) : home.isError ? (
            <ErrorState error={home.error} onRetry={() => void home.refetch()} />
          ) : home.data.enrolled_courses.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="size-6" />}
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
      <BattleHistory />
    </div>
  );
}
