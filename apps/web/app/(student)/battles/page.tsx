"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useHomeSummary, useMyLiveBattle } from "@scholau/api/react";
import { InvitationsPanel } from "@/components/battle/invitations-panel";
import { BattleHistory } from "@/components/battle/battle-history";
import { LiveResumeCard } from "@/components/battle/live-resume-card";
import { BattleRulesCard } from "@/components/battle/rules-card";
import { BattleStartPanel } from "@/components/battle/start-panel";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import "@/components/battle/battle-lobby.css";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

export default function BattlesPage() {
  return (
    <div className="battle-lobby flex flex-col gap-4">
      <header className="battle-hero">
        <div className="battle-hero-copy">
          <h1>Battles</h1>
          <p>1v1 quizzes. Earn XP for correct answers and match results.</p>
        </div>
      </header>
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
                  <Link href="/home">Browse courses</Link>
                </Button>
              }
            />
          ) : (
            <BattleStartPanel courses={home.data.enrolled_courses} initialOfferingId={params.get("offering")} initialFriendId={params.get("friend")} />
          )}
        </div>
        <BattleRulesCard />
      </div>
      <section aria-label="Challenges and recent battles" className="battle-community flex min-w-0 flex-col gap-4">
      <InvitationsPanel />
      <BattleHistory />
      <Link href="/social" className="battle-friends-summary rounded-2xl border border-[#c9ddfa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[5px] focus-visible:outline-brand-primary">
        <span><strong>Manage friends</strong><small>Find classmates and respond to requests on Social.</small></span>
        <ChevronRight className="battle-disclosure-chevron" size={18} aria-hidden />
      </Link>
      </section>
    </div>
  );
}
