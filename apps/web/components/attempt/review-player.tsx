"use client";

import { ArrowLeft, ArrowRight, CheckCheck, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { type Attempt, type AttemptQuestion, isApiError, newRequestKey, type ReviewCheckResult } from "@scholau/api";
import { useCheckReviewAnswer } from "@scholau/api/react";
import { COPY, errorMessage, pluralize } from "@scholau/core";
import { ReportDialog } from "@/components/report-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { LiveRegion } from "@/components/ui/misc";
import { EmptyState, InlineError } from "@/components/ui/states";
import { useBeforeUnload } from "@/lib/hooks";
import { AnswerFeedback } from "./answer-feedback";
import { AttemptHeader } from "./attempt-header";
import { AttemptTimer } from "./attempt-timer";
import { ExpiredNotice } from "./expired-notice";
import { QuestionLegend } from "./question-legend";
import { QuestionOptions } from "./question-options";
import { type RefetchAttempt, useAttemptLifecycle } from "./use-attempt-lifecycle";

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

interface QuestionView {
  locked: boolean;
  selected: string | null;
  feedback: { is_correct: boolean; correct_option_id: string; explanation: string } | null;
}

/** Review: one question at a time with immediate, server-checked feedback. The first checked answer is locked. */
export function ReviewPlayer({ attempt, onRefetch }: { attempt: Attempt; onRefetch: RefetchAttempt }) {
  const attemptId = attempt.attempt_id;
  const questions = attempt.questions;
  const check = useCheckReviewAnswer();
  const { submit, remaining, expired, onFinalized, markDeadlinePassed } = useAttemptLifecycle(attempt, onRefetch);

  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, ReviewCheckResult>>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, unknown>>({});
  const [checking, setChecking] = useState<string | null>(null);
  const [animatedQuestion, setAnimatedQuestion] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const viewOf = (q: AttemptQuestion): QuestionView => {
    const r = checked[q.question_version_id];
    if (r) return { locked: true, selected: r.option_id, feedback: r };
    if (q.saved?.locked) return { locked: true, selected: q.saved.option_id, feedback: q.feedback };
    return { locked: false, selected: choice[q.question_version_id] ?? null, feedback: null };
  };

  const uncheckedSelections = questions.filter((q) => !viewOf(q).locked && choice[q.question_version_id]).length;
  useBeforeUnload(!expired && uncheckedSelections > 0);

  if (questions.length === 0) {
    return <EmptyState title="This review has no questions" description={COPY.empty.contentRemoved} />;
  }

  const safeIndex = Math.min(index, questions.length - 1);
  const current = questions[safeIndex]!;
  const view = viewOf(current);
  const qv = current.question_version_id;
  const unchecked = questions.filter((q) => !viewOf(q).locked).length;

  const goTo = (i: number) => {
    setAnimatedQuestion(null);
    setIndex(i);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const choose = (optionId: string) => {
    setChoice((prev) => ({ ...prev, [qv]: optionId }));
    setKeys((prev) => omit(prev, qv));
    setErrors((prev) => omit(prev, qv));
  };

  const doCheck = () => {
    const optionId = choice[qv];
    if (!optionId) return;
    const requestKey = keys[qv] ?? newRequestKey();
    setKeys((prev) => ({ ...prev, [qv]: requestKey }));
    setErrors((prev) => omit(prev, qv));
    setChecking(qv);
    check
      .mutateAsync({ attemptId, questionVersionId: qv, optionId, requestKey })
      .then((res) => {
        setAnimatedQuestion(qv);
        setChecked((prev) => ({ ...prev, [qv]: res }));
        setAnnouncement(res.is_correct ? "Correct. Read the explanation below." : "Incorrect. Read the correct answer and explanation below.");
      })
      .catch((err: unknown) => {
        setErrors((prev) => ({ ...prev, [qv]: err }));
        setAnnouncement(isApiError(err) ? errorMessage(err) : "Something went wrong. Please try again.");
        if (isApiError(err, "DEADLINE_PASSED")) markDeadlinePassed();
      })
      .finally(() => setChecking(null));
  };

  const doSubmit = () => submit.mutate({ attemptId }, { onSuccess: onFinalized });
  const finish = () => (unchecked > 0 ? setConfirmOpen(true) : doSubmit());

  return (
    <>
      <AttemptHeader attempt={attempt}>
        {attempt.expires_at ? <AttemptTimer remainingMs={remaining} /> : null}
      </AttemptHeader>

      {expired ? <ExpiredNotice error={submit.error} onRetry={submit.retryLast} /> : null}

      <p className="mb-4 text-sm text-ink-muted">
        Check each answer to see if you&apos;re right. Your first checked answer is locked and saved.
      </p>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-4 sm:pt-6">
          <QuestionOptions
            name={`q-${qv}`}
            legend={<QuestionLegend ref={headingRef} position={safeIndex + 1} total={questions.length} prompt={current.prompt} />}
            options={current.options}
            value={view.selected}
            onChange={choose}
            disabled={view.locked || expired || checking === qv}
            reveal={view.feedback ? { correctOptionId: view.feedback.correct_option_id } : null}
          />

          {view.feedback ? (
            <AnswerFeedback key={qv} correct={view.feedback.is_correct} explanation={view.feedback.explanation} animate={animatedQuestion === qv} />
          ) : view.locked ? (
            <p className="text-sm text-ink-muted">Answer locked. Feedback will be shown in your results.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <InlineError error={errors[qv]} />
              <div>
                <Button onClick={doCheck} disabled={!choice[qv] || expired} loading={checking === qv}>
                  {errors[qv] ? <RefreshCw className="size-4" aria-hidden /> : null}
                  {errors[qv] ? "Try again" : "Check answer"}
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <ReportDialog targetType="question" targetId={qv} triggerLabel="Report this question" />
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => goTo(safeIndex - 1)} disabled={safeIndex === 0}>
            <ArrowLeft className="size-4" aria-hidden /> Previous
          </Button>
          <Button
            variant={view.locked && safeIndex < questions.length - 1 ? "primary" : "outline"}
            onClick={() => goTo(safeIndex + 1)}
            disabled={safeIndex >= questions.length - 1}
          >
            Next <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
        <Button
          variant={unchecked === 0 ? "primary" : "secondary"}
          onClick={finish}
          loading={submit.isPending && !confirmOpen}
          disabled={expired}
        >
          <CheckCheck className="size-4" aria-hidden /> Finish review
        </Button>
      </div>
      {!confirmOpen && !expired ? <InlineError error={submit.error} className="mt-3" /> : null}

      <LiveRegion>{announcement}</LiveRegion>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Finish this review?"
        description={`You haven't checked ${pluralize(unchecked, "question")}. Unchecked questions count as not answered.`}
        confirmLabel="Finish review"
        cancelLabel="Keep reviewing"
        onConfirm={doSubmit}
        loading={submit.isPending}
      >
        <InlineError error={submit.error} />
      </ConfirmDialog>
    </>
  );
}
