"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useHomeSummary, useMyLiveBattle } from "@scholau/api/react";
import { FriendsPanel } from "@/components/battle/friends-panel";
import { InvitationsPanel } from "@/components/battle/invitations-panel";
import { BattleHistory } from "@/components/battle/battle-history";
import { LiveResumeCard } from "@/components/battle/live-resume-card";
import { BattleRulesCard } from "@/components/battle/rules-card";
import { BattleStartPanel } from "@/components/battle/start-panel";
import { Button } from "@/components/ui/button";
import { ChevronDown, Swords, Trophy, Users, Zap } from "lucide-react";
import "@/components/battle/battle-lobby.css";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

export default function BattlesPage() {
  return (
    <div className="battle-lobby flex flex-col gap-4">
      <header className="battle-hero">
        <div className="battle-hero-copy">
          <span className="battle-eyebrow"><Zap size={14} aria-hidden /> THE BATTLE ARENA</span>
          <h1>Battles</h1>
          <p>Big brain. Friendly rivalry.</p>
          <span className="battle-hero-description">Put what you know to the test. Challenge a learner and make every answer count.</span>
          <div className="battle-hero-tags"><span><Users size={14} aria-hidden /> Head-to-head</span><span><Trophy size={14} aria-hidden /> Play for XP</span></div>
        </div>
        <div className="battle-hero-art" aria-hidden="true"><div className="battle-orbit" /><div className="battle-emblem"><Swords strokeWidth={1.6} /></div><span className="battle-art-star">✦</span><span className="battle-art-label">YOUR NEXT CHALLENGE</span></div>
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
      <details className="battle-friends-disclosure"><summary className="battle-friends-summary"><span className="battle-section-icon"><Users size={20} aria-hidden /></span><span><strong>Friends and requests</strong><small>Good friends. Great rivals.</small></span><ChevronDown className="battle-disclosure-chevron" size={18} aria-hidden /></summary><div className="pt-3"><FriendsPanel /></div></details>
      <BattleHistory />
    </div>
  );
}
