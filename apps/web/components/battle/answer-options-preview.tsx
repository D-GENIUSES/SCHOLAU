"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import type { BattleCurrentQuestion, BattleParticipant } from "@scholau/api";
import { Button } from "@/components/ui/button";
import { useServerCountdown } from "@/lib/hooks";
import { BattleAnswerOptions } from "./answer-options";
import { BattleTopBar, LiveBattleBoard } from "./battle-chrome";

const players: BattleParticipant[] = [
  { seat: 1, display_name: "adaeze", avatar_path: null, is_me: true, ready: true, forfeited: false, correct_count: 100 },
  { seat: 2, display_name: "tobi", avatar_path: null, is_me: false, ready: true, forfeited: false, correct_count: 100 },
];

const standard: BattleCurrentQuestion = {
  position: 2, prompt: "Which quantity is measured in newtons?", answer_format: "standard",
  course_code: "PHY 101",
  opened_at: "2026-01-01T00:00:00Z", deadline: "2026-01-01T00:00:10Z", my_option_id: null,
  options: [{ id: "force", body: "Force" }, { id: "energy", body: "Energy" }, { id: "power", body: "Power" }, { id: "mass", body: "Mass" }],
};

const worked: BattleCurrentQuestion = {
  ...standard, position: 3, prompt: "Solve 2x + 6 = 18. Choose the correct calculation and final answer.", answer_format: "worked_solution",
  options: [
    { id: "a", steps: ["2x = 18 − 6", "2x = 12", "x = 12 ÷ 2"], body: "x = 6" },
    { id: "b", steps: ["x = 18 ÷ 2 − 6", "x = 9 − 6"], body: "x = 3" },
    { id: "c", steps: ["2x = 18 + 6", "2x = 24", "x = 24 ÷ 2"], body: "x = 12" },
    { id: "d", steps: ["x = 18 − 6 ÷ 2", "x = 18 − 3"], body: "x = 15" },
  ],
};

/** Development-only host renders the same battle screen used by a live match. */
export function AnswerOptionsPreview() {
  const [normal, setNormal] = useState<string | null>("force");
  const [calculation, setCalculation] = useState<string | null>(null);
  const [clock, setClock] = useState(() => sampleWindow(8_000, 15_000));
  const [readingUntil, setReadingUntil] = useState<string | null>(null);
  const answerLeft = useServerCountdown(clock.deadline);
  const readingLeft = useServerCountdown(readingUntil);
  const reading = Boolean(readingUntil) && readingLeft > 0;
  const totalMs = reading ? 3_000 : clock.totalMs;

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-8 bg-surface-page px-4 py-5">
      <div className="live-battle-screen flex flex-col gap-5">
        <BattleTopBar battle={undefined} live onLeave={() => {}} />
        <LiveBattleBoard
          participants={players}
          roundCount={4}
          position={2}
          answered={[1]}
          courseCode="PHY 101"
          courseTitle="Physics"
          prompt={standard.prompt}
          promptId="preview-prompt"
          remainingMs={reading ? readingLeft : answerLeft}
          totalMs={totalMs}
          footer={
            <div className="flex flex-col gap-3">
              <Button size="lg" block className="min-h-[52px] bg-[#0875e4] text-[15px] hover:bg-[#0066d6]" disabled={reading || !normal || answerLeft <= 0}>
                <Lock className="size-4" aria-hidden />
                Lock in answer
              </Button>
              <p className="text-center text-[13px] text-[#8093a7]">
                {reading ? "Read the question and all four options. You will then have 5 seconds to answer." : "Choose one answer before time runs out."}
              </p>
            </div>
          }
        >
          <BattleAnswerOptions question={standard} selected={normal} disabled={reading || answerLeft <= 0} received={false} onSelect={setNormal} labelledBy="preview-prompt" />
        </LiveBattleBoard>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">Worked solution preview</p>
        <BattleAnswerOptions question={worked} selected={calculation} disabled={false} received={false} onSelect={setCalculation} />
        <Button
          variant="outline"
          onClick={() => {
            setNormal("force");
            setReadingUntil(new Date(Date.now() + 3000).toISOString());
            setClock(sampleWindow(11_000, 8_000));
          }}
        >
          Try reading time
        </Button>
      </div>
    </div>
  );
}

function sampleWindow(remainingMs: number, totalMs: number) {
  const now = Date.now();
  return {
    deadline: new Date(now + remainingMs).toISOString(),
    totalMs,
  };
}
