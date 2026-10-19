"use client";

import type { BattleCurrentQuestion } from "@scholau/api";
import { cn } from "@/lib/utils";

export function BattleAnswerOptions({ question, selected, disabled, received, onSelect, labelledBy }: {
  question: BattleCurrentQuestion;
  selected: string | null;
  disabled: boolean;
  received: boolean;
  onSelect: (id: string) => void;
  labelledBy?: string;
}) {
  const worked = question.answer_format === "worked_solution";
  return (
    <fieldset aria-labelledby={labelledBy} className="min-w-0">
      <legend className="sr-only">Answer choices</legend>
      {worked ? <p className="mb-3 text-center text-sm text-ink-muted">Choose the correct calculation and final answer.</p> : null}
      <div className="grid grid-cols-2 gap-3 max-[340px]:grid-cols-1">
        {question.options.map((option, index) => {
          const checked = selected === option.id;
          const letter = String.fromCharCode(65 + index);
          return (
            <label key={option.id} className={cn(
              "flex min-w-0 cursor-pointer rounded-2xl border-2 bg-white transition-colors focus-within:ring-2 focus-within:ring-[#0875e4] focus-within:ring-offset-2",
              worked ? "min-h-40 flex-col gap-3 p-3" : "min-h-16 items-center gap-2.5 px-3 py-2.5",
              checked ? "border-[#0875e4] bg-[#f4f9ff]" : "border-[#e5ebf1] hover:border-[#c9d5e2]",
              disabled && "cursor-default hover:border-[#e5ebf1]",
              disabled && checked && "hover:border-[#0875e4]",
            )}>
              <input
                type="radio"
                name={`battle-q-${question.position}`}
                value={option.id}
                checked={checked}
                disabled={disabled}
                onChange={() => onSelect(option.id)}
                className="sr-only"
              />
              <span className={cn("flex min-w-0 items-center gap-2.5", worked && "w-full")}>
                <span className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-[10px] border text-sm font-bold",
                  checked ? "border-transparent bg-[#e7f2ff] text-[#0875e4]" : "border-[#e1e7ee] bg-white text-[#1c3348]",
                )}>{letter}</span>
                {worked ? <ChoiceRadio checked={checked} className="ml-auto" /> : (
                  <span className="min-w-0 flex-1 break-words text-[15px] font-semibold text-ink">{option.body}</span>
                )}
                {worked ? null : <ChoiceRadio checked={checked} />}
              </span>
              {worked && option.steps?.length ? (
                <span className="flex flex-col gap-2 font-mono text-xs leading-relaxed sm:text-sm">
                  {option.steps.map((step, stepIndex) => <span key={stepIndex} className="whitespace-pre-wrap break-words">{step}</span>)}
                </span>
              ) : null}
              {worked ? <span className="mt-auto whitespace-pre-wrap break-words border-t border-[#e5ebf1] pt-3 text-[15px] font-bold text-ink">{option.body}</span> : null}
              {checked && received ? <span className="sr-only">Your answer</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ChoiceRadio({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span className={cn(
      "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
      checked ? "border-[#0875e4] bg-[#0875e4]" : "border-[#d3dbe4] bg-white",
      className,
    )} aria-hidden>
      {checked ? <span className="size-2 rounded-full bg-white" /> : null}
    </span>
  );
}
