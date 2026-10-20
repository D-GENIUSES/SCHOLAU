"use client";

import { useState } from "react";
import type { Battle } from "@scholau/api";
import { FocusShell } from "@/components/shell/focus-shell";
import { Button } from "@/components/ui/button";
import { BattleScoreboard } from "./arena";
import { BattleTopBar } from "./battle-chrome";
import { QuestionPanel } from "./question-panel";

const noRefetch = () => undefined;

/** Local-only visual fixture: uses the live question UI and never submits an answer. */
export function ArenaPreview() {
  const [battle, setBattle] = useState<Battle | null>(null);
  function start(worked = false) {
    const now = Date.now();
    setBattle({
      battle_id: "visual-preview", mode: "direct", state: "active", revision: now,
      offering_id: "preview", course: { id: "physics", code: "PHY 101", title: "Physics" },
      round_count: 4, seconds_per_round: 10, invitation_expires_at: null, ready_deadline: null,
      starts_at: null, ends_at: null, finalized_at: null, result_kind: null, cancel_reason: null,
      invite_token: null, me: { seat: 1, ready: true, forfeited: false },
      participants: [
        { seat: 1, display_name: "adaeze", avatar_path: null, is_me: true, ready: true, forfeited: false, correct_count: null },
        { seat: 2, display_name: "tobi", avatar_path: null, is_me: false, ready: true, forfeited: false, correct_count: null },
      ],
      current_question: {
        position: 2, course_code: "PHY 101", answer_format: worked ? "worked_solution" : "standard",
        duration_seconds: worked ? 15 : 10, reading_at: new Date(now).toISOString(),
        opened_at: new Date(now + 3000).toISOString(), deadline: new Date(now + (worked ? 18000 : 13000)).toISOString(), my_option_id: null,
        prompt: worked ? "A 2 kg object accelerates at 3 m/s². What force acts on it?" : "Which quantity is measured in newtons?",
        options: worked ? [
          { id: "force", steps: ["F = ma", "F = 2 × 3"], body: "6 N" },
          { id: "energy", steps: ["F = m ÷ a", "F = 2 ÷ 3"], body: "0.67 N" },
          { id: "power", steps: ["F = m + a", "F = 2 + 3"], body: "5 N" },
          { id: "mass", steps: ["F = a ÷ m", "F = 3 ÷ 2"], body: "1.5 N" },
        ] : [{ id: "force", body: "Force" }, { id: "energy", body: "Energy" }, { id: "power", body: "Power" }, { id: "mass", body: "Mass" }],
      },
      next_question_at: null, my_answered_positions: [1], rounds: null, outcome: null,
    });
  }
  return <FocusShell><div className="flex flex-col gap-4">
    <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => start()}>Preview question</Button><Button size="sm" variant="outline" onClick={() => start(true)}>Preview calculation</Button><span className="self-center text-xs text-ink-muted">Local preview · sample data</span></div>
    {battle?.current_question ? <><BattleTopBar battle={battle} live onLeave={() => setBattle(null)} /><BattleScoreboard battle={battle} /><QuestionPanel key={battle.revision} battle={battle} question={battle.current_question} refetch={noRefetch} /></> : <p className="text-ink-muted">Choose a sample to preview the battle arena.</p>}
  </div></FocusShell>;
}

