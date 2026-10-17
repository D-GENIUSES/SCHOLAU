"use client";

import type { BattleCurrentQuestion } from "@scholau/api";
import { cn } from "@/lib/utils";

export function BattleAnswerOptions({ question, selected, disabled, received, onSelect }: {
  question: BattleCurrentQuestion;
  selected: string | null;
  disabled: boolean;
  received: boolean;
  onSelect: (id: string) => void;
}) {
  const worked = question.answer_format === "worked_solution";
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-4 whitespace-pre-wrap text-lg font-bold text-ink">{question.prompt}</legend>
      {worked ? <p className="mb-3 text-sm text-ink-muted">Choose the correct calculation and final answer.</p> : null}
      <div className={worked ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "grid grid-cols-1 gap-3"}>
        {question.options.map((option, index) => {
          const checked = selected === option.id;
          return (
            <label key={option.id} className={cn(
              "relative flex min-w-0 cursor-pointer gap-3 border-2 p-4 transition-colors focus-within:ring-2 focus-within:ring-brand-primary focus-within:ring-offset-2",
              worked ? "min-h-44 flex-col rounded-2xl" : "min-h-16 items-center rounded-xl sm:rounded-full sm:px-6",
              checked ? "border-brand-primary bg-surface-tint" : "border-line bg-surface-card hover:border-brand-primary",
              disabled && "cursor-default",
            )}>
              <span className="flex items-center gap-2">
                <input type="radio" name={`battle-q-${question.position}`} value={option.id} checked={checked}
                  onChange={() => onSelect(option.id)} className="size-5 shrink-0 accent-brand-primary" />
                <span className="font-extrabold text-brand-primary">{String.fromCharCode(65 + index)}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-3 break-words">
                {worked && option.steps?.length ? (
                  <span className="flex flex-col gap-2 font-mono text-sm leading-relaxed">
                    {option.steps.map((step, i) => <span key={i} className="whitespace-pre-wrap">{step}</span>)}
                  </span>
                ) : null}
                <span className={cn("whitespace-pre-wrap", worked && "mt-auto border-t border-line pt-3 font-bold")}>{option.body}</span>
              </span>
              {checked && received ? <span className="text-xs font-semibold text-brand-primary">Your answer</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
