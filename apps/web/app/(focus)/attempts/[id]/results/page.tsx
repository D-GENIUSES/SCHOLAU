"use client";

import { ArrowLeft, RotateCcw, SearchCheck } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Attempt } from "@scholau/api";
import { useAttempt, useStartAttempt, useStartTopicReview } from "@scholau/api/react";
import { ASSESSMENT_KIND_LABEL, COPY, formatPercent, formatXpDelta } from "@scholau/core";
import { XpProgressCard } from "@/components/xp/xp-progress";
import { ResultQuestion } from "@/components/attempt/result-question";
import { XpCapNotice } from "@/components/lesson/xp-cap-notice";
import { ReportDialog } from "@/components/report-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, Stat } from "@/components/ui/misc";
import { ErrorState, InlineError, LoadingState, Spinner } from "@/components/ui/states";
import { useAnalytics } from "@/lib/analytics";
import { useServerCountdown } from "@/lib/hooks";

export default function AttemptResultsPage() {
  const { id } = useParams<{ id: string }>();
  const attempt = useAttempt(id);
  const remaining = useServerCountdown(attempt.data?.expires_at);

  if (!attempt.data) {
    if (attempt.isError) {
      return (
        <ErrorState
          error={attempt.error}
          onRetry={() => void attempt.refetch()}
          action={
            <Button asChild variant="outline">
              <Link href="/study">Back to Study</Link>
            </Button>
          }
        />
      );
    }
    return <LoadingState variant="assessment" label="Loading your results…" />;
  }

  const data = attempt.data;
  if (data.status === "active") {
    if (data.expires_at && remaining <= 0) return <GradingPoller attemptId={id} />;
    return (
      <Alert
        tone="info"
        title="This attempt is still in progress"
        action={
          <Button asChild>
            <Link href={`/attempts/${id}`}>Back to the attempt</Link>
          </Button>
        }
      >
        Results appear after you submit.
      </Alert>
    );
  }
  return <Results attempt={data} />;
}

const POLL_LIMIT_MS = 30_000;

function GradingPoller({ attemptId }: { attemptId: string }) {
  const [timedOut, setTimedOut] = useState(false);
  const poll = useAttempt(attemptId, { refetchInterval: timedOut ? false : 2000 });

  useEffect(() => {
    if (timedOut) return;
    const t = window.setTimeout(() => setTimedOut(true), POLL_LIMIT_MS);
    return () => window.clearTimeout(t);
  }, [timedOut]);

  return (
    <Alert tone="info" role="status" title={COPY.learning.expired}>
      {timedOut ? (
        <div className="flex flex-col gap-3">
          <p>Grading is taking longer than usual. Your saved answers are safe.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                setTimedOut(false);
                void poll.refetch();
              }}
            >
              Check again
            </Button>
            <ReportDialog targetType="technical" triggerLabel="Contact support" />
          </div>
        </div>
      ) : (
        <Spinner label="Grading…" />
      )}
    </Alert>
  );
}

function Results({ attempt }: { attempt: Attempt }) {
  const router = useRouter();
  const analytics = useAnalytics();
  const start = useStartAttempt();
  const scheduled = useStartTopicReview();
  const result = attempt.result;
  const total = result?.total_count ?? attempt.total_count;
  const correct = result?.correct_count ?? 0;
  const firstIncorrect = attempt.questions.find((q) => q.feedback && !(q.feedback.is_correct && q.saved));

  const reviewMistakes = () => {
    if (!firstIncorrect) return;
    const el = document.getElementById(`result-q-${firstIncorrect.position}`);
    el?.scrollIntoView({ block: "start" });
    el?.focus({ preventScroll: true });
  };

  const tryAgain = () => {
    if (attempt.xp_review_stage && attempt.lesson_id) {
      scheduled.mutate({ lessonId: attempt.lesson_id, stage: attempt.xp_review_stage }, {
        onSuccess: (a) => router.push(`/attempts/${a.attempt_id}`),
      });
      return;
    }
    start.mutate(
      { assessmentVersionId: attempt.assessment_version_id },
      {
        onSuccess: (a) => {
          analytics.track({ name: "attempt_started", assessment_kind: a.kind, attempt_id: a.attempt_id });
          router.push(`/attempts/${a.attempt_id}`);
        },
      },
    );
  };

  return (
    <>
      <PageHeader eyebrow={`${ASSESSMENT_KIND_LABEL[attempt.kind]} results`} title={attempt.title} />

      <div className="flex flex-col gap-4">
        {attempt.status === "voided" ? (
          <Alert tone="warning" title="This result was corrected by an administrator">
            {result?.voided_reason ?? "Any XP from this attempt was adjusted."}
          </Alert>
        ) : null}
        {attempt.status === "expired" ? (
          <Alert tone="info" title="Time ended">
            Only answers saved before the timer ended were graded.
          </Alert>
        ) : null}

        <Card>
          <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 sm:pt-6">
            <Stat label="Score" value={`${correct} / ${total} correct`} />
            <Stat label="Percent" value={formatPercent(result?.percent, Number.isInteger(result?.percent ?? 0) ? 0 : 1)} />
            <Stat label="Answered" value={`${result?.answered_count ?? 0} of ${total}`} />
            <Stat label="XP earned" value={formatXpDelta(result?.xp_awarded)} />
          </CardContent>
        </Card>

        {result?.xp_capped ? <XpCapNotice /> : null}
        {result?.xp_awarded === 0 && attempt.status !== "voided" ? <p className="text-sm text-ink-muted">{attempt.status === "expired" ? "Expired attempts do not earn XP. Submit a completed attempt to earn XP." : "Practice quizzes and mock exams earn 1 XP per correct answer. Topic checks reward improvements; scheduled reviews require at least 80% and award XP once per stage."}</p> : null}
        <XpProgressCard compact />

        <div className="flex flex-wrap gap-2">
          {firstIncorrect ? (
            <Button variant="secondary" onClick={reviewMistakes}>
              <SearchCheck className="size-4" aria-hidden /> Review mistakes
            </Button>
          ) : null}
          <Button onClick={tryAgain} loading={start.isPending || scheduled.isPending} disabled={Boolean(attempt.xp_review_stage && correct * 5 >= total * 4)}>
            <RotateCcw className="size-4" aria-hidden /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link href={`/study/courses/${attempt.offering_id}`}>
              <ArrowLeft className="size-4" aria-hidden /> Back to course
            </Link>
          </Button>
        </div>
        <InlineError error={start.error ?? scheduled.error} />

        <section aria-labelledby="results-questions" className="flex flex-col gap-3">
          <h2 id="results-questions" className="text-xl font-bold">
            Questions
          </h2>
          {attempt.questions.map((q) => (
            <ResultQuestion key={q.question_version_id} question={q} total={attempt.questions.length} />
          ))}
        </section>
      </div>
    </>
  );
}
