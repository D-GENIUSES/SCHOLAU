"use client";

import { cn } from "@/lib/utils";
import { ANSWER_STATUS, type AnswerStatus } from "./answer-status";

export function QuestionNavigator({
  statuses,
  current,
  onSelect,
}: {
  statuses: AnswerStatus[];
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Questions" className="flex flex-col gap-3">
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2">
        {statuses.map((status, i) => {
          const s = ANSWER_STATUS[status];
          const Icon = s.icon;
          const isCurrent = i === current;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Question ${i + 1}: ${s.label}`}
                title={s.label}
                className={cn(
                  "flex min-h-12 w-full flex-col items-center justify-center rounded-control border-2 bg-surface-card text-sm font-bold",
                  isCurrent ? "border-brand-primary text-brand-primary" : "border-line text-ink hover:border-line-strong",
                )}
              >
                <span>{i + 1}</span>
                <Icon className={cn("size-3.5", s.className)} aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted" aria-label="Status key">
        {(Object.keys(ANSWER_STATUS) as AnswerStatus[]).map((k) => {
          const s = ANSWER_STATUS[k];
          const Icon = s.icon;
          return (
            <li key={k} className="inline-flex items-center gap-1">
              <Icon className={cn("size-3.5", s.className)} aria-hidden />
              {s.short}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
