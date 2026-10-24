"use client";

import { useState } from "react";
import type { BattleCurrentQuestion } from "@scholau/api";
import { BattleAnswerOptions } from "./answer-options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useServerCountdown } from "@/lib/hooks";
import { CountdownBar } from "./countdown";

const standard: BattleCurrentQuestion = {
  position: 1, prompt: "Which quantity is measured in newtons?", answer_format: "standard",
  opened_at: "2026-01-01T00:00:00Z", deadline: "2026-01-01T00:00:10Z", my_option_id: null,
  options: [{ id: "force", body: "Force" }, { id: "energy", body: "Energy" }, { id: "power", body: "Power" }, { id: "mass", body: "Mass" }],
};
const worked: BattleCurrentQuestion = {
  ...standard, position: 2, prompt: "Solve 2x + 6 = 18. Choose the correct calculation and final answer.", answer_format: "worked_solution",
  options: [
    { id: "a", steps: ["2x = 18 − 6", "2x = 12", "x = 12 ÷ 2"], body: "x = 6" },
    { id: "b", steps: ["x = 18 ÷ 2 − 6", "x = 9 − 6"], body: "x = 3" },
    { id: "c", steps: ["2x = 18 + 6", "2x = 24", "x = 24 ÷ 2"], body: "x = 12" },
    { id: "d", steps: ["x = 18 − 6 ÷ 2", "x = 18 − 3"], body: "x = 15" },
  ],
};

/** Development-only host renders the same answer component used by live battles. */
export function AnswerOptionsPreview() {
  const [normal, setNormal] = useState<string | null>(null);
  const [calculation, setCalculation] = useState<string | null>(null);
  const [timing, setTiming] = useState<{ opened_at: string; deadline: string } | null>(null);
  const untilOpen = useServerCountdown(timing?.opened_at);
  const untilEnd = useServerCountdown(timing?.deadline);
  const reading = Boolean(timing && untilOpen > 0);
  return <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
    <p className="text-sm text-ink-muted">Development preview · local sample questions · no production content</p>
    <Card><CardHeader><CardTitle>Quick question · 5 seconds to answer</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">
      <Button variant="outline" onClick={() => { const now = Date.now(); setNormal(null); setTiming({ opened_at: new Date(now + 3000).toISOString(), deadline: new Date(now + 8000).toISOString() }); }}>Try reading + 5 seconds</Button>
      {timing ? <CountdownBar remainingMs={reading ? untilOpen : untilEnd} totalMs={reading ? 3000 : 5000} warnBelowMs={reading ? 0 : 2000} label={reading ? "Read first — answering starts shortly" : untilEnd > 0 ? "Time to answer" : "Time is up"} /> : <p className="text-sm text-ink-muted">Read the question and all four options first. Then the 5-second answer timer starts.</p>}
      <BattleAnswerOptions question={standard} selected={normal} disabled={Boolean(timing && (reading || untilEnd <= 0))} received={false} onSelect={setNormal} />
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Worked solution · 15 seconds</CardTitle></CardHeader><CardContent>
      <BattleAnswerOptions question={worked} selected={calculation} disabled={false} received={false} onSelect={setCalculation} />
    </CardContent></Card>
  </div>;
}
