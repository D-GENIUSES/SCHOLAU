"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { QuestionOptions } from "@/components/attempt/question-options";
import { MathText } from "@/components/math/math-text";
import { SolutionWalkthrough } from "@/components/math/solution-walkthrough";
import { QuestionActions } from "@/components/question-actions";
import { Button } from "@/components/ui/button";
import type { SharedStudyFeedback, SharedStudyQuestion, StudyLink } from "@/lib/shared-study";

export function SharedStudyPlayer({
  question, token, link, signInHref, startReport,
}: {
  question: SharedStudyQuestion;
  token: string;
  link: StudyLink;
  signInHref?: string;
  startReport: boolean;
}) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<SharedStudyFeedback | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim() || pending || feedback || unavailable) return;
    setError("");
    setPending(true);
    try {
      const response = await fetch(`/q/${token}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      if (response.status === 404) {
        setUnavailable(true);
        setError("This question is no longer available.");
        return;
      }
      if (!response.ok) throw new Error();
      setFeedback(await response.json() as SharedStudyFeedback);
    } catch {
      setError("Couldn’t check your answer. Try again.");
    } finally {
      setPending(false);
    }
  }

  const prompt = <span className="whitespace-pre-line break-words text-lg font-semibold"><MathText text={question.prompt} /></span>;
  const disabled = pending || unavailable || Boolean(feedback);

  return (
    <section className="rounded-card border border-line bg-surface-card p-4 shadow-raised sm:p-6" aria-label="Shared question">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="min-w-0 break-words text-sm font-semibold text-brand-primary">{question.topic}</p>
        <QuestionActions report={question.report} link={link} signInHref={signInHref} startReport={startReport} />
      </div>
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        {question.options.length ? (
          <QuestionOptions
            name="shared-answer"
            legend={prompt}
            options={question.options.map((option, index) => ({ ...option, label: String.fromCharCode(65 + index) }))}
            value={answer || null}
            onChange={setAnswer}
            disabled={disabled}
          />
        ) : (
          <label className="flex flex-col gap-3">
            {prompt}
            <span className="text-sm font-semibold">Your answer</span>
            <input value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={disabled} maxLength={500} className="min-h-11 rounded-control border border-line px-3" />
          </label>
        )}
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        {!feedback && !unavailable ? <Button type="submit" disabled={!answer.trim()} loading={pending}>Check answer</Button> : null}
      </form>
      <div aria-live="polite">
        {feedback ? (
          <div className="mt-5 flex flex-col gap-3 rounded-control bg-surface-tint p-4">
            <p className="font-bold">{feedback.correct ? "You got it!" : "Not quite."}</p>
            <p className="break-words text-sm"><strong>Correct answer</strong> <MathText text={feedback.answer} /></p>
            <SolutionWalkthrough explanation={feedback.explanation} steps={feedback.steps} />
          </div>
        ) : null}
      </div>
      {feedback || unavailable ? <Button asChild className="mt-5 w-full"><Link href="/home">Keep practising on ScholAu</Link></Button> : null}
    </section>
  );
}