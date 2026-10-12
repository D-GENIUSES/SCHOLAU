"use client";

import { Eye } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useState } from "react";
import type { AdminAssessmentVersionRow, AdminLessonVersionRow, AdminQuestionVersionRow } from "@scholau/api";
import { useAdminAssessmentVersions, useAdminLessonVersions, useAdminQuestionVersions } from "@scholau/api/react";
import { ASSESSMENT_KIND_LABEL, type ContentStatus, formatDateTime, formatDuration } from "@scholau/core";
import { type Column, DataTable } from "@/components/admin/data-table";
import { AssessmentDetail, LessonDetail, QuestionDetail } from "@/components/admin/review-details";
import { AdminErrorState, CONTENT_STATUSES, FilterSelect, humanize, StatusBadge } from "@/components/admin/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, LoadingState } from "@/components/ui/states";

type Tab = "lessons" | "questions" | "assessments";

const TABS: readonly { value: Tab; label: string }[] = [
  { value: "lessons", label: "Lessons" },
  { value: "questions", label: "Questions" },
  { value: "assessments", label: "Assessments" },
];

const parseTab = (v: string | null): Tab => (v === "questions" || v === "assessments" ? v : "lessons");
const parseStatus = (v: string | null): ContentStatus => (v === "published" || v === "retired" ? v : "draft");

interface TabProps {
  status: ContentStatus;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDone: (message: string) => void;
}

function PreviewButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant={active ? "secondary" : "outline"} onClick={onClick} aria-pressed={active} aria-label={`Preview ${label}`}>
      <Eye className="size-4" aria-hidden /> Preview
    </Button>
  );
}

function ListState<T>({
  query,
  noun,
  status,
  children,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; data: T[] | undefined; refetch: () => unknown };
  noun: string;
  status: ContentStatus;
  children: (rows: T[]) => ReactNode;
}) {
  if (query.isPending) return <LoadingState label={`Loading ${noun}…`} />;
  if (query.isError) return <AdminErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title={`No ${status} ${noun}`}
        description={status === "draft" ? "Import content to create drafts for review." : "Try another status filter."}
      />
    );
  }
  return <>{children(rows)}</>;
}

function LessonsTab({ status, selectedId, onSelect, onDone }: TabProps) {
  const query = useAdminLessonVersions(status);
  return (
    <ListState query={query} noun="lesson versions" status={status}>
      {(rows) => {
        const selected = rows.find((r) => r.id === selectedId);
        const columns: Column<AdminLessonVersionRow>[] = [
          { key: "title", header: "Title", cell: (r) => r.title },
          { key: "version", header: "Version", cell: (r) => r.version },
          { key: "minutes", header: "Time", cell: (r) => `${r.estimated_minutes} min` },
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          { key: "created", header: "Created", cell: (r) => formatDateTime(r.created_at) },
          {
            key: "actions",
            header: "Actions",
            action: true,
            cell: (r) => (
              <PreviewButton active={r.id === selectedId} label={`${r.title} version ${r.version}`} onClick={() => onSelect(r.id)} />
            ),
          },
        ];
        return (
          <>
            {selected ? <LessonDetail row={selected} onClose={() => onSelect(null)} onDone={onDone} /> : null}
            <DataTable
              caption={`${humanize(status)} lesson versions`}
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              isSelected={(r) => r.id === selectedId}
            />
          </>
        );
      }}
    </ListState>
  );
}

function QuestionsTab({ status, selectedId, onSelect, onDone }: TabProps) {
  const query = useAdminQuestionVersions(status);
  return (
    <ListState query={query} noun="question versions" status={status}>
      {(rows) => {
        const columns: Column<AdminQuestionVersionRow>[] = [
          {
            key: "prompt",
            header: "Prompt",
            cell: (r) => <span className="line-clamp-3 font-normal">{r.prompt}</span>,
            className: "min-w-64",
          },
          { key: "key", header: "Key", cell: (r) => <code className="font-mono text-sm break-all">{r.question?.logical_key ?? "—"}</code> },
          { key: "pool", header: "Pool", cell: (r) => humanize(r.question?.pool) },
          { key: "usage", header: "Usage", cell: (r) => r.usage.map(humanize).join(", ") || "—" },
          { key: "version", header: "Version", cell: (r) => r.version },
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "Actions",
            action: true,
            cell: (r) => (
              <PreviewButton
                active={r.id === selectedId}
                label={`question ${r.question?.logical_key ?? r.id} version ${r.version}`}
                onClick={() => onSelect(r.id)}
              />
            ),
          },
        ];
        return (
          <>
            {selectedId ? <QuestionDetail id={selectedId} onClose={() => onSelect(null)} onDone={onDone} /> : null}
            <DataTable
              caption={`${humanize(status)} question versions`}
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              isSelected={(r) => r.id === selectedId}
            />
          </>
        );
      }}
    </ListState>
  );
}

function AssessmentsTab({ status, selectedId, onSelect, onDone }: TabProps) {
  const query = useAdminAssessmentVersions(status);
  return (
    <ListState query={query} noun="assessment versions" status={status}>
      {(rows) => {
        const selected = rows.find((r) => r.id === selectedId);
        const columns: Column<AdminAssessmentVersionRow>[] = [
          { key: "title", header: "Title", cell: (r) => r.assessment?.title ?? "—" },
          { key: "kind", header: "Kind", cell: (r) => (r.assessment ? ASSESSMENT_KIND_LABEL[r.assessment.kind] : "—") },
          { key: "questions", header: "Questions", cell: (r) => r.question_count },
          { key: "duration", header: "Duration", cell: (r) => formatDuration(r.duration_seconds) },
          { key: "version", header: "Version", cell: (r) => r.version },
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "Actions",
            action: true,
            cell: (r) => (
              <PreviewButton
                active={r.id === selectedId}
                label={`${r.assessment?.title ?? "assessment"} version ${r.version}`}
                onClick={() => onSelect(r.id)}
              />
            ),
          },
        ];
        return (
          <>
            {selected ? <AssessmentDetail row={selected} onClose={() => onSelect(null)} onDone={onDone} /> : null}
            <DataTable
              caption={`${humanize(status)} assessment versions`}
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              isSelected={(r) => r.id === selectedId}
            />
          </>
        );
      }}
    </ListState>
  );
}

function ReviewView() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => parseTab(params.get("tab")));
  const [status, setStatus] = useState<ContentStatus>(() => parseStatus(params.get("status")));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const changeTab = (t: Tab) => {
    setTab(t);
    setSelectedId(null);
    setNotice(null);
  };
  const changeStatus = (s: ContentStatus) => {
    setStatus(s);
    setSelectedId(null);
    setNotice(null);
  };
  const onSelect = (id: string | null) => {
    setSelectedId(id);
    setNotice(null);
  };
  const onDone = (message: string) => {
    setSelectedId(null);
    setNotice(message);
  };

  const props: TabProps = { status, selectedId, onSelect, onDone };

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Review"
        description="Preview drafts, then publish them. Publishing records you as the reviewer and is permanent for that version."
      />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-full overflow-x-auto">
          <Segmented name="review-tab" legend="Content type" value={tab} onChange={changeTab} options={TABS} />
        </div>
        <FilterSelect label="Status" value={status} onChange={changeStatus} options={CONTENT_STATUSES} />
      </div>

      <div role="status" aria-live="polite">
        {notice ? (
          <Alert tone="success" title={notice} className="mb-6" action={<Button variant="link" onClick={() => setNotice(null)}>Dismiss</Button>} />
        ) : null}
      </div>

      {tab === "lessons" ? <LessonsTab {...props} /> : null}
      {tab === "questions" ? <QuestionsTab {...props} /> : null}
      {tab === "assessments" ? <AssessmentsTab {...props} /> : null}
    </>
  );
}

export default function AdminReviewPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading review…" />}>
      <ReviewView />
    </Suspense>
  );
}
