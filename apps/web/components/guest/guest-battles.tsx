"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Battle } from "@scholau/api";
import { BattleScoreboard } from "@/components/battle/arena";
import { Button } from "@/components/ui/button";

const sampleBattle: Pick<Battle, "participants"> = {
  participants: [
    { seat: 1, display_name: "Ada M.", avatar_path: null, is_me: true, ready: true, forfeited: false, correct_count: null },
    { seat: 2, display_name: "Tobi A.", avatar_path: null, is_me: false, ready: true, forfeited: false, correct_count: null },
  ],
};

const steps = [
  { label: "Match up", description: "Two players are matched." },
  { label: "Timed rounds", description: "Each round has a time limit." },
  { label: "Result", description: "The final score is shown." },
];

type Phase = "ready" | "match" | "round" | "result";

export function GuestBattles() {
  const [phase, setPhase] = useState<Phase>("ready");
  const running = phase === "match" || phase === "round";
  const activeStep = phase === "match" ? 0 : phase === "round" ? 1 : phase === "result" ? 2 : -1;

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setPhase(phase === "match" ? "round" : "result"), phase === "match" ? 1800 : 4200);
    return () => window.clearTimeout(timer);
  }, [phase, running]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <header className="home-welcome"><div><h1>Battles</h1></div></header>
      <section aria-labelledby="guest-battle-title" className="flex flex-col gap-4 rounded-card border border-line bg-surface-page p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="guest-battle-title" className="text-lg font-semibold text-ink">How quiz battles work</h2>
          <span className="rounded-full bg-surface-tint px-2.5 py-1 text-xs font-semibold text-brand-primary">Demo</span>
        </div>
        <ol className="grid grid-cols-3 gap-2 text-center text-xs">
          {steps.map(({ label, description }, index) => (
            <li key={label} className="rounded-control bg-surface-tint p-2 aria-[current=step]:ring-1 aria-[current=step]:ring-brand-primary" aria-current={index === activeStep ? "step" : undefined}>
              <span className="block font-semibold text-ink">{label}</span>
              <span className="mt-1 hidden text-ink-muted motion-reduce:block">{description}</span>
            </li>
          ))}
        </ol>
        <BattleScoreboard battle={sampleBattle} preview />
        <div className="motion-reduce:hidden">
          <div role="status" className="min-h-12 text-center text-sm font-medium text-ink-muted">
            {phase === "ready" && "See a sample 1v1 battle."}
            {phase === "match" && "Match found"}
            {phase === "round" && "Round 2 of 5"}
            {phase === "result" && "Match complete · Sample score 4–3"}
            {phase === "round" && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                <div className="guest-battle-time h-full origin-left rounded-full bg-brand-primary" />
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mx-auto flex w-fit"
            aria-disabled={running}
            onClick={() => { if (!running) setPhase("match"); }}
          >
            {running ? "Playing preview" : phase === "result" ? "Replay" : "Play preview"}
          </Button>
        </div>
      </section>
      <Button asChild className="self-start"><Link href="/sign-in?next=%2Fbattles">Sign in to battle</Link></Button>
    </div>
  );
}
