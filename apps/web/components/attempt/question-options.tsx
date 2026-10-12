"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { AttemptOption } from "@scholau/api";
import { cn } from "@/lib/utils";

/**
 * Single-choice options as a native radio group. `reveal` highlights the correct option and the
 * learner's wrong choice with icon + text (never colour alone).
 */
export function QuestionOptions({
  name,
  legend,
  options,
  value,
  onChange,
  disabled,
  reveal,
}: {
  name: string;
  legend: ReactNode;
  options: AttemptOption[];
  value: string | null;
  onChange: (optionId: string) => void;
  disabled?: boolean;
  reveal?: { correctOptionId: string } | null;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3" disabled={disabled}>
      <legend className="mb-3 w-full">{legend}</legend>
      {options.map((o, i) => {
        const id = `${name}-${o.id}`;
        const checked = value === o.id;
        const isCorrect = reveal ? o.id === reveal.correctOptionId : false;
        const isWrongChoice = reveal ? checked && !isCorrect : false;
        return (
          <div key={o.id} className="relative">
            <input
              type="radio"
              id={id}
              name={name}
              value={o.id}
              checked={checked}
              onChange={() => onChange(o.id)}
              className="peer sr-only"
            />
            <label
              htmlFor={id}
              className={cn(
                "flex min-h-12 cursor-pointer items-start gap-3 rounded-control border-2 bg-surface-card p-3 transition-colors",
                "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-primary",
                "peer-disabled:cursor-default",
                checked ? "border-brand-primary bg-surface-tint" : "border-line hover:border-line-strong",
                isCorrect && "border-success bg-success-bg",
                isWrongChoice && "border-danger bg-danger-bg",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-pill border-2 text-sm font-bold",
                  checked ? "border-brand-primary bg-brand-primary text-ink-inverse" : "border-line-strong text-ink-muted",
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="whitespace-pre-line break-words">{o.body}</span>
                {isCorrect ? (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                    <CheckCircle2 className="size-4" aria-hidden /> Correct answer
                  </span>
                ) : null}
                {isWrongChoice ? (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-danger">
                    <XCircle className="size-4" aria-hidden /> Your answer
                  </span>
                ) : null}
              </span>
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
