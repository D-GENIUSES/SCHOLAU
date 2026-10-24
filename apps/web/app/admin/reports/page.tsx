"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, CircleDot, Clock, XCircle } from "lucide-react";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { type AdminReportRow, newRequestKey } from "@scholau/api";
import { useAdminReports, useAdminTriageReport } from "@scholau/api/react";
import { formatDateTime, REPORT_CATEGORIES, type ReportState, triageReportSchema } from "@scholau/core";
import { type Column, DataTable } from "@/components/admin/data-table";
import { AdminErrorState, CopyableId, FilterSelect, humanize, MutationError } from "@/components/admin/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/shared";
import { Badge } from "@/components/ui/misc";
import { EmptyState, LoadingState } from "@/components/ui/states";

type Filter = ReportState | "all";

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "triaged", label: "Triaged" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

const TRIAGE_STATES = [
  { value: "triaged", label: "Triaged", hint: "Acknowledged and being looked at." },
  { value: "resolved", label: "Resolved", hint: "Fixed. Describe what changed." },
  { value: "dismissed", label: "Dismissed", hint: "No change needed. Explain why." },
] as const;

const categoryLabel = (c: string) => REPORT_CATEGORIES.find((x) => x.value === c)?.label ?? humanize(c);

function ReportStateBadge({ state }: { state: ReportState }) {
  if (state === "open")
    return (
      <Badge tone="warning">
        <CircleDot className="size-3.5" aria-hidden /> Open
      </Badge>
    );
  if (state === "triaged")
    return (
      <Badge tone="brand">
        <Clock className="size-3.5" aria-hidden /> Triaged
      </Badge>
    );
  if (state === "resolved")
    return (
      <Badge tone="success">
        <CheckCircle2 className="size-3.5" aria-hidden /> Resolved
      </Badge>
    );
  return (
    <Badge tone="neutral">
      <XCircle className="size-3.5" aria-hidden /> Dismissed
    </Badge>
  );
}

const triageFormSchema = triageReportSchema.superRefine((v, ctx) => {
  if ((v.state === "resolved" || v.state === "dismissed") && !v.resolution?.trim()) {
    ctx.addIssue({ code: "custom", path: ["resolution"], message: "Add a resolution note for resolved or dismissed reports." });
  }
});
type TriageForm = z.infer<typeof triageFormSchema>;

function TriageDialog({ report, onClose, onDone }: { report: AdminReportRow; onClose: () => void; onDone: (m: string) => void }) {
  const resolutionId = useId();
  const triage = useAdminTriageReport();
  const [requestKey] = useState(newRequestKey);
  const form = useForm<TriageForm>({
    resolver: zodResolver(triageFormSchema),
    defaultValues: { state: report.state === "open" ? "triaged" : (report.state as TriageForm["state"]), resolution: report.resolution ?? "" },
  });
  const state = useWatch({ control: form.control, name: "state" });
  const resolutionRequired = state === "resolved" || state === "dismissed";

  const submit = form.handleSubmit((v) =>
    triage.mutate(
      { reportId: report.id, state: v.state, resolution: v.resolution?.trim() || undefined, requestKey },
      { onSuccess: (r) => onDone(`Report marked ${r.state}.`) },
    ),
  );

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogTitle>Triage report</DialogTitle>
        <DialogDescription>
          {categoryLabel(report.category)} · {humanize(report.target_type)} · reported {formatDateTime(report.created_at)}
        </DialogDescription>
        <blockquote className="rounded-control border border-line bg-surface-page p-3 text-sm whitespace-pre-line break-words">{report.note}</blockquote>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">New state</legend>
            {TRIAGE_STATES.map((s) => (
              <label key={s.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control border border-line p-3 has-[:checked]:border-brand-primary has-[:checked]:bg-surface-tint">
                <input type="radio" value={s.value} {...form.register("state")} className="mt-1 size-4 accent-brand-primary" />
                <span>
                  <span className="block font-semibold">{s.label}</span>
                  <span className="block text-sm text-ink-muted">{s.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Field
            id={resolutionId}
            label="Resolution"
            optional={!resolutionRequired}
            hint={resolutionRequired ? "Required. Recorded in the audit log." : "Recorded in the audit log."}
            error={form.formState.errors.resolution?.message}
          >
            <Textarea maxLength={2000} {...form.register("resolution")} />
          </Field>
          <MutationError error={triage.error} />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" loading={triage.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminReportsPage() {
  const [filter, setFilter] = useState<Filter>("open");
  const query = useAdminReports(filter === "all" ? null : filter);
  const [active, setActive] = useState<AdminReportRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const columns: Column<AdminReportRow>[] = [
    { key: "created", header: "Reported", cell: (r) => <span className="font-normal whitespace-nowrap">{formatDateTime(r.created_at)}</span> },
    {
      key: "target",
      header: "Target",
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-semibold">{humanize(r.target_type)}</span>
          <CopyableId id={r.target_id} short />
        </span>
      ),
    },
    { key: "category", header: "Category", cell: (r) => categoryLabel(r.category) },
    { key: "note", header: "Note", cell: (r) => <span className="line-clamp-4 whitespace-pre-line">{r.note}</span>, className: "min-w-56" },
    { key: "state", header: "State", cell: (r) => <ReportStateBadge state={r.state} /> },
    { key: "resolution", header: "Resolution", cell: (r) => r.resolution ?? "—" },
    {
      key: "actions",
      header: "Actions",
      action: true,
      cell: (r) => (
        <Button
          size="sm"
          variant={r.state === "open" ? "primary" : "outline"}
          onClick={() => {
            setNotice(null);
            setActive(r);
          }}
          aria-label={`Triage ${categoryLabel(r.category)} report from ${formatDateTime(r.created_at)}`}
        >
          {r.state === "open" ? "Triage" : "Update"}
        </Button>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader title="Reports" description="Content and technical problems reported by students." />
      <div className="mb-6">
        <FilterSelect label="State" value={filter} onChange={setFilter} options={FILTERS} />
      </div>
      <div role="status" aria-live="polite">
        {notice ? (
          <Alert tone="success" title={notice} className="mb-6" action={<Button variant="link" onClick={() => setNotice(null)}>Dismiss</Button>} />
        ) : null}
      </div>
      {query.isPending ? (
        <LoadingState label="Loading reports…" />
      ) : query.isError ? (
        <AdminErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState title={filter === "all" ? "No reports" : `No ${filter} reports`} description="Reports from students appear here." />
      ) : (
        <>
          <DataTable caption="Content reports" columns={columns} rows={query.data} rowKey={(r) => r.id} />
          {query.data.length >= 100 ? <p className="mt-3 text-sm text-ink-muted">Showing the 100 most recent reports.</p> : null}
        </>
      )}
      {active ? (
        <TriageDialog
          report={active}
          onClose={() => setActive(null)}
          onDone={(m) => {
            setActive(null);
            setNotice(m);
          }}
        />
      ) : null}
    </>
  );
}
