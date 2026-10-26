import { MathText } from "@/components/math/math-text";
import { forwardRef } from "react";

/** Rendered inside the options <legend>; the heading receives focus when moving between questions. */
export const QuestionLegend = forwardRef<HTMLHeadingElement, { position: number; total: number; prompt: string }>(
  function QuestionLegend({ position, total, prompt }, ref) {
    return (
      <>
        <h2 ref={ref} tabIndex={-1} className="mb-2 text-sm font-semibold text-ink-muted">
          Question {position} of {total}
        </h2>
        <span className="block whitespace-pre-line break-words text-lg font-semibold text-ink"><MathText text={prompt} /></span>
      </>
    );
  },
);
