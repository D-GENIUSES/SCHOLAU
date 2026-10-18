"use client";

import { CheckCircle2, X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import type { AdminAssessmentVersionRow, AdminLessonVersionRow } from "@scholau/api";
import { useAdminQuestion } from "@scholau/api/react";
import { ASSESSMENT_KIND_LABEL, type ContentStatus, formatDateTime, formatDuration } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { BlockPreview } from "./block-preview";
import { IMMUTABLE_WARNING, PublishActions } from "./publish-actions";
import { AdminErrorState, CopyableId, humanize, StatusBadge } from "./shared";

const REVIEWER_NOTE = "Publishing records you as the reviewer. Any currently published version of the same item is retired as superseded.";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

function SourceReference({ value }: { value: string | null }) {
  if (value && value.trim()) return <>{value}</>;
  return <span className="font-semibold text-danger">Missing — required before publishing</span>;
}

function Reviewer({ id }: { id: string | null }) {
  return id ? <CopyableId id={id} short /> : <span className="text-ink-muted">Not reviewed yet</span>;
}

function DetailShell({
  heading,
  status,
  version,
  onClose,
  children,
  actions,
}: {
  heading: string;
  status?: ContentStatus;
  version?: number;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [heading]);
  return (
    <Card className="mb-6 border-brand-primary">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold break-words">
            {heading}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {status ? <StatusBadge status={status} /> : null}
            {version !== undefined ? <span className="text-sm text-ink-muted">Version {version}</span> : null}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close preview">
          <X className="size-5" aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">{children}</CardContent>
      {actions ? <CardFooter>{actions}</CardFooter> : null}
    </Card>
  );
}

export function LessonDetail({ row, onClose, onDone }: { row: AdminLessonVersionRow; onClose: () => void; onDone: (m: string) => void }) {
  const label = `lesson “${row.title}” v${row.version}`;
  return (
    <DetailShell
      heading={row.title}
      status={row.status}
      version={row.version}
      onClose={onClose}
      actions={
        <PublishActions
          entityType="lesson_version"
          id={row.id}
          status={row.status}
          label={label}
          canRetire={row.status === "published"}
          publishDescription={IMMUTABLE_WARNING}
          publishDetails={<p>{REVIEWER_NOTE}</p>}
          retireDescription="Students will no longer see this version. Progress history is kept."
          onDone={onDone}
        />
      }
    >
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Detail label="Objective">{row.objective}</Detail>
        <Detail label="Estimated time">{row.estimated_minutes} min</Detail>
        <Detail label="Source reference">
          <SourceReference value={row.source_reference} />
        </Detail>
        <Detail label="Reviewer">
          <Reviewer id={row.reviewed_by} />
        </Detail>
        <Detail label="Created">{formatDateTime(row.created_at)}</Detail>
        <Detail label="Published">{row.published_at ? formatDateTime(row.published_at) : "—"}</Detail>
        <Detail label="Lesson version ID">
          <CopyableId id={row.id} />
        </Detail>
        <Detail label="Lesson ID">
          <CopyableId id={row.lesson_id} />
        </Detail>
      </dl>
      <section aria-label="Content preview" className="rounded-control border border-line bg-surface-page p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink-muted">Content preview (text only)</h3>
        <div className="max-w-reading">
          <BlockPreview blocks={row.blocks} />
        </div>
      </section>
    </DetailShell>
  );
}

export function QuestionDetail({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: (m: string) => void }) {
  const q = useAdminQuestion(id);

  if (q.isPending) {
    return (
      <DetailShell heading="Question" onClose={onClose}>
        <LoadingState label="Loading question…" lines={2} />
      </DetailShell>
    );
  }
  if (q.isError) {
    return (
      <DetailShell heading="Question" onClose={onClose}>
        <AdminErrorState error={q.error} onRetry={() => void q.refetch()} />
      </DetailShell>
    );
  }
  const d = q.data;
  const label = `question “${d.logical_key}” v${d.version}`;
  return (
    <DetailShell
      heading={`Question ${d.logical_key}`}
      status={d.status}
      version={d.version}
      onClose={onClose}
      actions={
        <PublishActions
          entityType="question_version"
          id={d.question_version_id}
          status={d.status}
          label={label}
          canRetire={d.status === "published"}
          publishDescription={IMMUTABLE_WARNING}
          publishDetails={<p>{REVIEWER_NOTE}</p>}
          retireDescription="This version will stop appearing in new attempts and battles. Past results are kept."
          onDone={onDone}
        />
      }
    >
      <div>
        <h3 className="text-sm font-semibold text-ink-muted">Prompt</h3>
        <p className="mt-1 text-lg whitespace-pre-line">{d.prompt}</p>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-ink-muted">Options</h3>
        <p className="text-sm text-ink-muted">{d.answer_format === "worked_solution" ? "Worked solutions" : "Standard options"} · {d.battle_reading_seconds ?? d.suggested_reading_seconds ?? "Auto"} seconds to read · {d.battle_seconds ?? d.suggested_answer_seconds ?? "Auto"} seconds to answer</p>
        {d.correct_option_id === null ? (
          <Alert tone="error" title="No answer key" className="mt-2">
            This version has no correct option recorded. It can&apos;t be published.
          </Alert>
        ) : null}
        <ul className="mt-2 flex flex-col gap-2">
          {d.options.map((o) => {
            const correct = o.id === d.correct_option_id;
            return (
              <li
                key={o.id}
                className={cn(
                  "flex items-start gap-3 rounded-control border p-3",
                  correct ? "border-[#b8e0cc] bg-success-bg" : "border-line bg-surface-card",
                )}
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-pill border border-line bg-surface-card font-bold">
                  {o.label}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-line">
                  {o.steps?.map((step, index) => <span key={index} className="mb-2 block font-mono text-sm">{step}</span>)}
                  <strong>{o.body}</strong>
                </span>
                {correct ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-success">
                    <CheckCircle2 className="size-4" aria-hidden /> Correct answer
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-ink-muted">Explanation</h3>
        <p className="mt-1 whitespace-pre-line">{d.explanation || <span className="text-danger">Missing</span>}</p>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Detail label="Source reference">
          <SourceReference value={d.source_reference} />
        </Detail>
        <Detail label="Reviewer">
          <Reviewer id={d.reviewed_by} />
        </Detail>
        <Detail label="Pool">{humanize(d.pool)}</Detail>
        <Detail label="Usage">{d.usage.length ? d.usage.map(humanize).join(", ") : "—"}</Detail>
        <Detail label="Difficulty">{humanize(d.difficulty)}</Detail>
        <Detail label="Published">{d.published_at ? formatDateTime(d.published_at) : "—"}</Detail>
        <Detail label="Question version ID">
          <CopyableId id={d.question_version_id} />
        </Detail>
        <Detail label="Lesson ID">
          <CopyableId id={d.lesson_id} />
        </Detail>
      </dl>
    </DetailShell>
  );
}

export function AssessmentDetail({
  row,
  onClose,
  onDone,
}: {
  row: AdminAssessmentVersionRow;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const title = row.assessment?.title ?? "Assessment";
  const label = `assessment “${title}” v${row.version}`;
  return (
    <DetailShell
      heading={title}
      status={row.status}
      version={row.version}
      onClose={onClose}
      actions={
        <PublishActions
          entityType="assessment_version"
          id={row.id}
          status={row.status}
          label={label}
          canRetire={row.status === "published"}
          publishDescription={IMMUTABLE_WARNING}
          publishDetails={
            <>
              <p>{REVIEWER_NOTE}</p>
              <p>Every question must already be a published learning-pool question of this course with a matching usage.</p>
            </>
          }
          retireDescription="Students won't be able to start new attempts on this version. Past attempts are kept."
          onDone={onDone}
        />
      }
    >
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Detail label="Kind">{row.assessment ? ASSESSMENT_KIND_LABEL[row.assessment.kind] : "—"}</Detail>
        <Detail label="Questions">{row.question_count}</Detail>
        <Detail label="Duration">{formatDuration(row.duration_seconds)}</Detail>
        <Detail label="Created">{formatDateTime(row.created_at)}</Detail>
        <Detail label="Assessment version ID">
          <CopyableId id={row.id} />
        </Detail>
        <Detail label="Course ID">
          <CopyableId id={row.assessment?.course_id} />
        </Detail>
      </dl>
    </DetailShell>
  );
}
