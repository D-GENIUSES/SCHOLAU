import { MathText } from "@/components/math/math-text";
import type { AttemptQuestion } from "@scholau/api";
import { cn } from "@/lib/utils";
import { CorrectnessBadge } from "./answer-feedback";

function optionLabel(q: AttemptQuestion, optionId: string | null | undefined): string | null {
  if (!optionId) return null;
  const i = q.options.findIndex((o) => o.id === optionId);
  const o = q.options[i];
  return o ? `${String.fromCharCode(65 + i)}. ${o.body}` : null;
}

export function ResultQuestion({ question, total }: { question: AttemptQuestion; total: number }) {
  const yours = optionLabel(question, question.saved?.option_id);
  const fb = question.feedback;
  const correct = optionLabel(question, fb?.correct_option_id);
  const isCorrect = Boolean(fb?.is_correct && question.saved);
  return (
    <article
      id={`result-q-${question.position}`}
      tabIndex={-1}
      aria-labelledby={`result-q-${question.position}-title`}
      className={cn(
        "flex scroll-mt-4 flex-col gap-3 rounded-card border bg-surface-card p-4 sm:p-6",
        fb ? (isCorrect ? "border-[#b8e0cc]" : "border-[#f3c4bf]") : "border-line",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`result-q-${question.position}-title`} className="text-sm font-semibold text-ink-muted">
          Question {question.position} of {total}
        </h3>
        {fb ? <CorrectnessBadge correct={isCorrect} /> : null}
      </div>
      <p className="whitespace-pre-line break-words text-lg font-semibold"><MathText text={question.prompt} /></p>
      <dl className="grid gap-2 text-base sm:grid-cols-[max-content_1fr] sm:gap-x-4">
        <dt className="text-sm font-semibold text-ink-muted">Your answer</dt>
        <dd className="whitespace-pre-line break-words"><MathText text={yours ?? "Not answered"} /></dd>
        {fb ? (
          <>
            <dt className="text-sm font-semibold text-ink-muted">Correct answer</dt>
            <dd className="whitespace-pre-line break-words"><MathText text={correct ?? "Unavailable"} /></dd>
          </>
        ) : null}
      </dl>
      {fb?.explanation ? (
        <div className="rounded-control bg-surface-page p-3">
          <p className="text-sm font-semibold">Explanation</p>
          <p className="whitespace-pre-line"><MathText text={fb.explanation} /></p>
        </div>
      ) : null}
      {!fb ? <p className="text-sm text-ink-muted">Answer details aren&apos;t available for this result.</p> : null}
    </article>
  );
}
