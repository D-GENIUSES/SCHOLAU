"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LessonBlocks } from "@/components/lesson/blocks";
import { OpponentPickerOption } from "./opponent-picker";
import { BattleResultCelebration } from "./result-celebration";
import "./battle-lobby.css";

/** Isolated visual/audio fixture; never starts a real battle or changes progress. */
export function FeedbackPreview() {
  const [effect, setEffect] = useState<{ result: "win" | "loss"; key: number } | null>(null);
  return <div className="mx-auto flex max-w-reading flex-col gap-6 p-5">
    <h1 className="text-xl font-bold">Learning feedback preview</h1>
    <p className="text-sm text-ink-muted">Sample data. No account progress changes.</p>
    <div className="flex gap-3">
      <Button onClick={() => setEffect({ result: "win", key: (effect?.key ?? 0) + 1 })}>Preview win</Button>
      <Button onClick={() => setEffect({ result: "loss", key: (effect?.key ?? 0) + 1 })}>Preview loss</Button>
    </div>
    {effect ? <BattleResultCelebration key={effect.key} result={effect.result} /> : null}
    <div className="battle-opponent-results" aria-label="Sample opponents">
      {["oyindaesty", "Popoola Rahmat", "FioyeSzn", "David Chukwuemeka Nwankwo with a very long display name"].map((name, i) => <OpponentPickerOption key={name} selected={false} onChoose={() => undefined} person={{
        user_id: `sample-${i}`, display_name: name, username: `classmate_${i}`, online: i === 3, avatar_path: null, state: "accepted", incoming: false,
      }} />)}
    </div>
    <LessonBlocks blocks={[{ type: "code", language: "text", code: `LECTURE 9
METHODS AND PARAMETER PASSING
A method is a named block of code that performs a particular task.
Example:
static int add(int a, int b) {
  return a + b;
}
9.1 Why Use Methods?
Methods help us:
• avoid repetition
• organise programs
• improve readability` }]} />
  </div>;
}
