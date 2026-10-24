"use client";

import { useState } from "react";
import type { AuditItem } from "@scholau/api";
import { useAdminAudit } from "@scholau/api/react";
import { formatDateTime } from "@scholau/core";
import { type Column, DataTable } from "@/components/admin/data-table";
import { AdminErrorState, CopyableId, FilterSelect, humanize } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/shared";
import { EmptyState, LoadingState } from "@/components/ui/states";

const ENTITY_TYPES = [
  "lesson_version",
  "question_version",
  "assessment_version",
  "course_offering",
  "battle_rules",
  "attempt",
  "battle",
  "entitlement",
  "content_report",
  "profile",
  "user_role",
  "question_import",
  "lesson_import",
] as const;

const FILTERS = [{ value: "all", label: "All entity types" }, ...ENTITY_TYPES.map((t) => ({ value: t, label: humanize(t) }))];

function Metadata({ value }: { value: Record<string, unknown> }) {
  if (!value || Object.keys(value).length === 0) return <span className="text-ink-muted">—</span>;
  return (
    <details className="max-w-md">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-primary">View JSON</summary>
      <pre className="mt-1 max-h-72 overflow-auto rounded-control bg-surface-page p-3 text-xs break-all whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

const columns: Column<AuditItem>[] = [
  { key: "time", header: "Time", cell: (r) => <span className="font-normal whitespace-nowrap">{formatDateTime(r.created_at)}</span> },
  { key: "action", header: "Action", cell: (r) => humanize(r.action) },
  { key: "type", header: "Entity type", cell: (r) => <code className="font-mono text-sm">{r.entity_type}</code> },
  { key: "entity", header: "Entity ID", cell: (r) => <CopyableId id={r.entity_id} short /> },
  { key: "actor", header: "Actor", cell: (r) => (r.actor_id ? <CopyableId id={r.actor_id} short /> : "System") },
  { key: "reason", header: "Reason", cell: (r) => r.reason ?? "—" },
  { key: "metadata", header: "Metadata", cell: (r) => <Metadata value={r.safe_metadata} /> },
];

export default function AdminAuditPage() {
  const [filter, setFilter] = useState<string>("all");
  const query = useAdminAudit(filter === "all" ? null : filter);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <AdminPageHeader title="Audit log" description="Every admin action and automated entitlement change, newest first." />
      <div className="mb-6">
        <FilterSelect label="Entity type" value={filter} onChange={setFilter} options={FILTERS} className="w-full sm:w-72" />
      </div>
      {query.isPending ? (
        <LoadingState label="Loading audit log…" />
      ) : query.isError && !query.isFetchNextPageError ? (
        <AdminErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="No audit entries" description="Try another entity type." />
      ) : (
        <div className="flex flex-col gap-4">
          <DataTable caption="Audit log entries" columns={columns} rows={items} rowKey={(r) => r.id} />
          {query.isFetchNextPageError ? <AdminErrorState error={query.error} onRetry={() => void query.fetchNextPage()} /> : null}
          {query.hasNextPage ? (
            <div>
              <Button variant="outline" onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>
                Load more
              </Button>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">End of the audit log.</p>
          )}
        </div>
      )}
    </>
  );
}
