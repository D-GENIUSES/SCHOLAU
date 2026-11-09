"use client";

import type { BattleRoundResult, BattleRoundStatus } from "@scholau/api";

const LABELS: Record<BattleRoundStatus, { text: string; icon: string }> = {
  correct: { text: "Correct", icon: "✅" },
  incorrect: { text: "Incorrect", icon: "❌" },
  unanswered: { text: "No answer", icon: "⏱️" },
};

/** Lives outside the question panel so the last result survives question transitions. */
export function BattleRoundResultStrip({ result }: { result?: BattleRoundResult | null }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {result ? (
        <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-surface-tint px-3 py-2 text-xs sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-4 sm:text-sm">
          <strong className="col-span-2 text-brand-primary">Q{result.position} · Round result</strong>
          <Result label="You" status={result.my_status} />
          <Result label="Opponent" status={result.opponent_status} />
        </div>
      ) : null}
    </div>
  );
}

function Result({ label, status }: { label: string; status: BattleRoundStatus }) {
  const value = LABELS[status];
  return <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1"><span>{label}:</span><span className="whitespace-nowrap"><strong>{value.text}</strong> <span aria-hidden="true">{value.icon}</span></span></span>;
}
