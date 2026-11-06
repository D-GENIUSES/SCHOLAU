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
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-xl border border-line bg-surface-tint px-3 py-2 text-xs sm:text-sm">
          <strong>Q{result.position}</strong>
          <Result label="You" status={result.my_status} />
          <Result label="Opponent" status={result.opponent_status} />
        </div>
      ) : null}
    </div>
  );
}

function Result({ label, status }: { label: string; status: BattleRoundStatus }) {
  const value = LABELS[status];
  return <span>{label}: <strong>{value.text}</strong> <span aria-hidden="true">{value.icon}</span></span>;
}
