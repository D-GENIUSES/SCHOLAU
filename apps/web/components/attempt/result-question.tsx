import { QuestionActions } from "@/components/question-actions";
import { MathText } from "@/components/math/math-text";
import Link from "next/link";
import { SolutionWalkthrough } from "@/components/math/solution-walkthrough";
import type { AttemptQuestion } from "@scholau/api";
import { cn } from "@/lib/utils";
import { CorrectnessBadge } from "./answer-feedback";

function optionLabel(q: AttemptQuestion, optionId: string | null | undefined): string | null {
  if (!optionId) return null;
  const i = q.options.findIndex((o) => o.id === optionId);
  const o = q.options[i];
  return o ? `${String.fromCharCode(65 + i)}. ${o.body}` : null;
}

export function ResultQuestion({ question, total, reteach, study }: { question: AttemptQuestion; total: number; study?: boolean; reteach?: { lesson_id: string; lesson_title: string } }) {
  const yours = question.saved?.text_answer ?? optionLabel(question, question.saved?.option_id);
  const fb = question.feedback;
  const correct = fb?.correct_text_answer ?? optionLabel(question, fb?.correct_option_id);
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
        <div className="flex items-center gap-2">
          {fb ? <CorrectnessBadge correct={isCorrect} /> : null}
          {study ? <QuestionActions source={{ kind: "bank", version: question.question_version_id }} report={{ targetType: "question", targetId: question.question_version_id }} /> : null}
        </div>
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
      {fb ? (
        !isCorrect ? (
          <details className="rounded-control bg-surface-page p-3" open>
            <summary className="cursor-pointer font-semibold">Explain this mistake</summary>
            <p className="mt-2 text-sm text-ink-muted">Your answer was <MathText text={yours ?? "blank"} />. Compare it with the correct answer and follow the explanation below.</p>
            <div className="mt-3"><SolutionWalkthrough explanation={fb.explanation} steps={fb.steps} /></div>
          </details>
        ) : (
          <div className="rounded-control bg-surface-page p-3">
            <SolutionWalkthrough explanation={fb.explanation} steps={fb.steps} />
          </div>
        )
      ) : null}
      {!fb ? <p className="text-sm text-ink-muted">Answer details aren&apos;t available for this result.</p> : null}
      {fb && !isCorrect && reteach ? <Link className="font-semibold text-brand-primary underline" href={"/study/lessons/" + reteach.lesson_id + "?focus=worked_example"}>Revisit the lesson example: {reteach.lesson_title}</Link> : null}
    </article>
  );
}
