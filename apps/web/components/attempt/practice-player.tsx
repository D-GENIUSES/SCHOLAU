"use client";

import { ArrowLeft, ArrowRight, RefreshCw, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Attempt, type AttemptAnswerValue, type AttemptQuestion, isApiError, newRequestKey } from "@scholau/api";
import { useSaveAttemptAnswers } from "@scholau/api/react";
import { COPY, pluralize } from "@scholau/core";
import { QuestionActions } from "@/components/question-actions";
import { ReportDialog } from "@/components/report-dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LiveRegion } from "@/components/ui/misc";
import { EmptyState, InlineError } from "@/components/ui/states";
import { useBeforeUnload, useOnline } from "@/lib/hooks";
import { AnswerStatusLabel, type AnswerStatus } from "./answer-status";
import { AttemptHeader } from "./attempt-header";
import { PracticeHints } from "./practice-hints";
import { AttemptTimer } from "./attempt-timer";
import { ExpiredNotice } from "./expired-notice";
import { QuestionLegend } from "./question-legend";
import { QuestionNavigator } from "./question-navigator";
import { QuestionOptions } from "./question-options";
import { type RefetchAttempt, useAttemptLifecycle } from "./use-attempt-lifecycle";

interface LocalAnswer {
  value: AttemptAnswerValue;
  revision: number;
  /** One key per save intent; manual retries reuse it. */
  requestKey: string;
  status: "saving" | "saved" | "failed";
  rebased?: boolean;
}

function serverRevisionFromError(fieldErrors: Record<string, unknown> | undefined, qv: string): number | null {
  const info = fieldErrors?.[qv];
  if (info && typeof info === "object" && "answer_revision" in info) {
    const n = Number((info as { answer_revision: unknown }).answer_revision);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Practice and mock attempts: answers autosave; results and explanations only after submit. */
export function PracticePlayer({ attempt, onRefetch }: { attempt: Attempt; onRefetch: RefetchAttempt }) {
  const attemptId = attempt.attempt_id;
  const questions = attempt.questions;
  const online = useOnline();
  const save = useSaveAttemptAnswers();
  const { submit, remaining, expired, onFinalized, markDeadlinePassed } = useAttemptLifecycle(attempt, onRefetch);

  const [local, setLocal] = useState<Record<string, LocalAnswer>>({});
  const [writtenDrafts, setWrittenDrafts] = useState<Record<string, string>>({});
  const localRef = useRef(local);
  useEffect(() => {
    localRef.current = local;
  }, [local]);

  const [index, setIndex] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const patch = useCallback((qv: string, revision: number, update: Partial<LocalAnswer>) => {
    setLocal((prev) => {
      const cur = prev[qv];
      if (!cur || cur.revision !== revision) return prev;
      return { ...prev, [qv]: { ...cur, ...update } };
    });
  }, []);

  const { mutateAsync: saveAsync } = save;
  const runSave = useCallback(
    function run(qv: string, position: number, entry: LocalAnswer) {
      saveAsync({
        attemptId,
        answers: [{ question_version_id: qv, ...entry.value, answer_revision: entry.revision }],
        requestKey: entry.requestKey,
      })
        .then((res) => {
          const acked = res.saved.some((s) => s.question_version_id === qv && s.answer_revision === entry.revision);
          patch(qv, entry.revision, { status: acked ? "saved" : "failed" });
          if (localRef.current[qv]?.revision === entry.revision) {
            setAnnouncement(acked ? `Question ${position}: ${COPY.learning.saved}` : `Question ${position}: ${COPY.learning.unsaved}`);
          }
        })
        .catch((err: unknown) => {
          if (isApiError(err, "DEADLINE_PASSED")) {
            patch(qv, entry.revision, { status: "failed" });
            markDeadlinePassed();
            return;
          }
          if (isApiError(err, "STALE_REVISION") && !entry.rebased) {
            const fromError = serverRevisionFromError(err.field_errors, qv);
            void onRefetch().then((r) => {
              const latest = localRef.current[qv];
              if (!latest || latest.revision !== entry.revision) return;
              const fromServer = r.data?.questions.find((q) => q.question_version_id === qv)?.saved?.answer_revision ?? 0;
              const next: LocalAnswer = {
                ...latest,
                revision: Math.max(fromError ?? 0, fromServer, entry.revision) + 1,
                requestKey: newRequestKey(),
                status: "saving",
                rebased: true,
              };
              setLocal((prev) => ({ ...prev, [qv]: next }));
              run(qv, position, next);
            });
            return;
          }
          patch(qv, entry.revision, { status: "failed" });
          if (localRef.current[qv]?.revision === entry.revision) {
            setAnnouncement(`Question ${position}: ${COPY.learning.unsaved}`);
          }
        });
    },
    [attemptId, saveAsync, patch, markDeadlinePassed, onRefetch],
  );

  function unsavedWriting(q: AttemptQuestion) {
    const draft = writtenDrafts[q.question_version_id]?.trim();
    const saved = local[q.question_version_id]?.value.text_answer ?? q.saved?.text_answer;
    return draft && draft !== saved ? draft : null;
  }

  useBeforeUnload(!expired && (Object.values(local).some(l => l.status !== "saved") || questions.some(unsavedWriting)));

  if (questions.length === 0) {
    return <EmptyState title="This attempt has no questions" description={COPY.empty.contentRemoved} />;
  }

  const safeIndex = Math.min(index, questions.length - 1);
  const current = questions[safeIndex]!;

  const statusOf = (q: AttemptQuestion): AnswerStatus => {
    if (unsavedWriting(q)) return "unsaved";
    const l = local[q.question_version_id];
    if (l) return l.status === "saved" ? "saved" : l.status === "failed" ? "unsaved" : "selected";
    return q.saved ? "saved" : "not_answered";
  };
  const statuses = questions.map(statusOf);
  const unanswered = statuses.filter((s) => s === "not_answered").length;
  const pending = questions.flatMap(q => {
    const l = local[q.question_version_id];
    const draft = unsavedWriting(q);
    if (draft) return [{
      question_version_id: q.question_version_id,
      text_answer: draft,
      answer_revision: Math.max(l?.revision ?? 0, q.saved?.answer_revision ?? 0) + 1,
    }];
    return l && l.status !== "saved"
      ? [{ question_version_id: q.question_version_id, ...l.value, answer_revision: l.revision }]
      : [];
  });

  const goTo = (i: number) => {
    setIndex(i);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const choose = (q: AttemptQuestion, value: AttemptAnswerValue) => {
    if (expired) return;
    const qv = q.question_version_id;
    const base = Math.max(local[qv]?.revision ?? 0, q.saved?.answer_revision ?? 0);
    const entry: LocalAnswer = { value, revision: base + 1, requestKey: newRequestKey(), status: "saving" };
    setLocal((prev) => ({ ...prev, [qv]: entry }));
    runSave(qv, q.position, entry);
  };

  const retry = (q: AttemptQuestion) => {
    const l = local[q.question_version_id];
    if (!l) return;
    const entry: LocalAnswer = { ...l, status: "saving", rebased: false };
    setLocal((prev) => ({ ...prev, [q.question_version_id]: entry }));
    runSave(q.question_version_id, q.position, entry);
  };

  const doSubmit = () => {
    submit.mutate(
      {
        attemptId,
        answers: pending,
      },
      { onSuccess: onFinalized },
    );
  };

  return (
    <>
      <AttemptHeader attempt={attempt}>
        {attempt.expires_at ? <AttemptTimer remainingMs={remaining} /> : null}
      </AttemptHeader>

      {expired ? <ExpiredNotice error={submit.error} onRetry={submit.retryLast} /> : null}
      {!online ? (
        <Alert tone="warning" className="mb-4">
          {COPY.empty.offline} Answers you choose now show “{COPY.learning.unsaved}” until they reach the server.
        </Alert>
      ) : null}

      <p className="mb-4 text-sm text-ink-muted">
        Your answers are saved to the server as you go. Results and explanations appear after you submit.
      </p>

      <div className="mb-6">
        <QuestionNavigator statuses={statuses} current={safeIndex} onSelect={goTo} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-4 sm:pt-6">
          {attempt.kind === "practice" ? (
            <div className="flex justify-end">
              <QuestionActions
                key={current.question_version_id}
                source={{ kind: "bank", version: current.question_version_id }}
                report={{ targetType: "question", targetId: current.question_version_id }}
              />
            </div>
          ) : null}
          {current.answer_format === "fill_in_gap" ? (
            <div className="space-y-3">
              <QuestionLegend ref={headingRef} position={safeIndex + 1} total={questions.length} prompt={current.prompt} />
              <label htmlFor="written-answer" className="block text-sm font-semibold">Fill in the blank</label>
              <div className="flex flex-wrap items-center gap-2">
                <Input id="written-answer" maxLength={240} className="min-w-0 flex-1"
                  value={writtenDrafts[current.question_version_id] ?? local[current.question_version_id]?.value.text_answer ?? current.saved?.text_answer ?? ""}
                  onChange={event => {
                    const value = event.target.value;
                    setWrittenDrafts(previous => ({ ...previous, [current.question_version_id]: value }));
                  }}
                  disabled={expired || submit.isPending} />
                <Button type="button" variant="outline" size="sm" disabled={expired || submit.isPending || !unsavedWriting(current)}
                  onClick={() => {
                    const text = unsavedWriting(current);
                    if (text) choose(current, { text_answer: text });
                  }}>Save answer</Button>
              </div>
            </div>
          ) : (
            <QuestionOptions
              name={`q-${current.question_version_id}`}
              legend={<QuestionLegend ref={headingRef} position={safeIndex + 1} total={questions.length} prompt={current.prompt} />}
              options={current.options}
              value={local[current.question_version_id]?.value.option_id ?? current.saved?.option_id ?? null}
              onChange={(optionId) => choose(current, { option_id: optionId })}
              disabled={expired || submit.isPending}
            />
          )}
          {attempt.kind === "practice" ? <PracticeHints key={current.question_version_id} attemptId={attemptId} questionVersionId={current.question_version_id} /> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <AnswerStatusLabel
                status={statuses[safeIndex] ?? "not_answered"}
                saving={local[current.question_version_id]?.status === "saving"}
              />
              {statuses[safeIndex] === "unsaved" && !expired && !unsavedWriting(current) ? (
                <Button variant="outline" size="sm" onClick={() => retry(current)}>
                  <RefreshCw className="size-4" aria-hidden /> Retry save
                </Button>
              ) : null}
            </div>
            {attempt.kind !== "practice" ? <ReportDialog targetType="question" targetId={current.question_version_id} triggerLabel="Report this question" /> : null}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => goTo(safeIndex - 1)} disabled={safeIndex === 0}>
            <ArrowLeft className="size-4" aria-hidden /> Previous
          </Button>
          <Button variant="outline" onClick={() => goTo(safeIndex + 1)} disabled={safeIndex >= questions.length - 1}>
            Next <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
        <Button onClick={() => setConfirmOpen(true)} disabled={expired}>
          <Send className="size-4" aria-hidden /> Submit
        </Button>
      </div>

      <LiveRegion>{announcement}</LiveRegion>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit your answers?"
        description="After you submit you can't change your answers. Results and explanations appear next."
        confirmLabel="Submit"
        cancelLabel="Keep working"
        onConfirm={doSubmit}
        loading={submit.isPending}
      >
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            {unanswered > 0
              ? `You have ${pluralize(unanswered, "unanswered question")}.`
              : "You have answered every question."}
          </li>
          {pending.length > 0 ? (
            <li>
              {pluralize(pending.length, "answer")} not saved yet — we&apos;ll send {pending.length === 1 ? "it" : "them"} with your
              submission.
            </li>
          ) : null}
        </ul>
        <InlineError error={submit.error} />
      </ConfirmDialog>
    </>
  );
}
