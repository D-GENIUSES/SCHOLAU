import type { LessonBlock } from "@scholau/core";
import { Equation, MathText } from "./math-text";

export function WorkedExample({ block }: { block: Extract<LessonBlock, { type: "worked_example" }> }) {
  return <section className="min-w-0 rounded-control border border-line bg-surface-page p-4 sm:p-5">
    <h3 className="text-lg font-bold"><MathText text={block.title} /></h3>
    <p className="mt-2"><MathText text={block.problem} /></p>
    <ol className="mt-4 flex list-none flex-col gap-5">
      {block.steps.map((step, index) => <li key={index} className="min-w-0">
        <p className="text-sm font-semibold text-ink-muted">Step {index + 1}</p>
        <Equation expression={step.calculation} reading={step.reading} display />
        <p className="mt-2 leading-relaxed"><MathText text={step.explanation} /></p>
      </li>)}
    </ol>
    <div className="mt-5 border-t border-line pt-3">
      <p className="font-bold">Final answer</p>
      <Equation expression={block.answer} reading={block.answer_reading} display />
    </div>
    {block.check ? <div className="mt-4">
      <p className="font-semibold">Check the answer</p>
      <Equation expression={block.check.calculation} reading={block.check.reading} display />
      <p className="mt-2"><MathText text={block.check.explanation} /></p>
    </div> : null}
  </section>;
}
