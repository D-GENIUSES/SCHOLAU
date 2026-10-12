"use client";

import { useState } from "react";
import type { AdminOfferingRow } from "@scholau/api";
import { useAdminOfferings } from "@scholau/api/react";
import { formatDate } from "@scholau/core";
import { type Column, DataTable } from "@/components/admin/data-table";
import { PublishActions } from "@/components/admin/publish-actions";
import { AdminErrorState, StatusBadge } from "@/components/admin/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState, LoadingState } from "@/components/ui/states";

const courseLabel = (r: AdminOfferingRow) => (r.course ? `${r.course.code} ${r.course.title}` : "offering");

export default function AdminOfferingsPage() {
  const query = useAdminOfferings();
  const [notice, setNotice] = useState<string | null>(null);

  const columns: Column<AdminOfferingRow>[] = [
    {
      key: "course",
      header: "Course",
      cell: (r) =>
        r.course ? (
          <span className="flex flex-col">
            <span className="font-bold">{r.course.code}</span>
            <span className="font-normal">{r.course.title}</span>
          </span>
        ) : (
          "—"
        ),
    },
    { key: "department", header: "Department", cell: (r) => r.department?.name ?? "—" },
    { key: "level", header: "Level", cell: (r) => r.level?.label ?? "—" },
    { key: "semester", header: "Semester", cell: (r) => r.semester?.label ?? "—" },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "created", header: "Created", cell: (r) => formatDate(r.created_at) },
    {
      key: "actions",
      header: "Actions",
      action: true,
      cell: (r) => (
        <PublishActions
          size="sm"
          entityType="course_offering"
          id={r.id}
          status={r.status}
          label={courseLabel(r)}
          canRetire={r.status !== "retired"}
          publishDescription="The offering becomes visible in the catalog to students whose department, level and semester match."
          publishDetails={<p>Only its published lessons and assessments are shown to students.</p>}
          retireDescription="Students can no longer find or enroll in this offering. A retired offering can't be republished."
          retiredNote="Retired — can't be republished."
          onDone={setNotice}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Offerings" description="A course offered to a department, level and semester." />
      <div role="status" aria-live="polite">
        {notice ? (
          <Alert tone="success" title={notice} className="mb-6" action={<Button variant="link" onClick={() => setNotice(null)}>Dismiss</Button>} />
        ) : null}
      </div>
      {query.isPending ? (
        <LoadingState label="Loading offerings…" />
      ) : query.isError ? (
        <AdminErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState title="No offerings yet" description="Course offerings are created by the content seed or database migrations." />
      ) : (
        <DataTable caption="Course offerings" columns={columns} rows={query.data} rowKey={(r) => r.id} />
      )}
    </>
  );
}
