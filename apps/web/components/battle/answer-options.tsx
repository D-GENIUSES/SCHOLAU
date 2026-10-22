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
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-4 w-full whitespace-pre-wrap break-words text-center text-lg font-bold leading-snug tracking-tight text-ink sm:text-xl">{question.prompt}</legend>
      {worked ? <p className="mb-3 text-sm text-ink-muted">Choose the correct calculation and final answer.</p> : null}
      <div className={worked ? "grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3" : "grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:gap-3"}>
        {question.options.map((option, index) => {
          const checked = selected === option.id;
          return (
            <label key={option.id} className={cn(
              "relative flex min-w-0 cursor-pointer gap-3 border-2 transition-colors focus-within:ring-2 focus-within:ring-brand-primary focus-within:ring-offset-2",
              worked ? "min-h-40 flex-col rounded-2xl p-3 sm:min-h-44 sm:p-4" : "min-h-[56px] items-center rounded-xl px-3 py-2 sm:min-h-[64px]",
              checked ? "border-brand-primary bg-surface-tint" : "border-brand-primary/20 bg-surface-card hover:border-brand-primary",
              disabled && "cursor-default",
            )}>
              <span className="flex shrink-0 items-center gap-2">
                <input type="radio" name={`battle-q-${question.position}`} value={option.id} checked={checked}
                  onChange={() => onSelect(option.id)} className="peer sr-only" />
                <span className="flex size-8 items-center justify-center rounded-full bg-surface-tint text-sm font-bold text-brand-primary peer-checked:bg-brand-primary peer-checked:text-white">{String.fromCharCode(65 + index)}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-3 break-words">
                {worked && option.steps?.length ? (
                  <span className="flex flex-col gap-2 font-mono text-xs leading-relaxed sm:text-sm">
                    {option.steps.map((step, i) => <span key={i} className="whitespace-pre-wrap">{step}</span>)}
                  </span>
                ) : null}
                <span className={cn("whitespace-pre-wrap text-sm font-semibold", worked && "mt-auto border-t border-line pt-3 font-bold")}>{option.body}</span>
              </span>
              {checked ? <span className="sr-only">{received ? "Answer received" : "Selected"}</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
