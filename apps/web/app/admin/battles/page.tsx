"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ban } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { type AdminBattleRow, type CorrectResultResult, newRequestKey } from "@scholau/api";
import { useAdminBattles, useAdminCorrectResult } from "@scholau/api/react";
import { type BattleState, formatDateTime, formatXpDelta, reasonSchema } from "@scholau/core";
import { type Column, DataTable } from "@/components/admin/data-table";
import { AdminErrorState, CopyableId, FilterSelect, humanize, MutationError, ReasonDialog } from "@/components/admin/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Badge, PageHeader } from "@/components/ui/misc";
import { EmptyState, LoadingState } from "@/components/ui/states";

type Filter = BattleState | "all";

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "finished", label: "Finished" },
  { value: "active", label: "Active" },
  { value: "countdown", label: "Countdown" },
  { value: "ready", label: "Ready" },
  { value: "waiting", label: "Waiting" },
  { value: "cancelled", label: "Cancelled" },
  { value: "voided", label: "Voided" },
];

const VOID_EXPLANATION =
  "Voiding reverses XP with compensating ledger entries and notifies both players. History is never deleted.";

function BattleStateBadge({ state }: { state: BattleState }) {
  const tone = state === "finished" ? "success" : state === "voided" || state === "cancelled" ? "neutral" : "brand";
  return <Badge tone={tone}>{humanize(state)}</Badge>;
}

function Compensations({ result }: { result: CorrectResultResult }) {
  return (
    <Alert tone="success" title={`${humanize(result.result_type)} voided`} role="status">
      <p>
        <code className="font-mono break-all">{result.result_id}</code>
      </p>
      {result.compensations.length === 0 ? (
        <p className="mt-1">No XP needed reversing.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {result.compensations.map((c) => (
            <li key={c.adjusts_entry_id} className="break-words">
              <span className="font-semibold">{formatXpDelta(c.amount)}</span> for user{" "}
              <code className="font-mono">{c.user_id.slice(0, 8)}</code> (adjusts ledger entry{" "}
              <code className="font-mono">{c.adjusts_entry_id.slice(0, 8)}</code>)
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}

const attemptSchema = z.object({
  attemptId: z.string().trim().uuid("Enter a valid attempt ID."),
  reason: reasonSchema,
});
type AttemptForm = z.infer<typeof attemptSchema>;

function VoidAttemptForm({ onDone }: { onDone: (r: CorrectResultResult) => void }) {
  const idField = useId();
  const reasonField = useId();
  const correct = useAdminCorrectResult();
  const [pending, setPending] = useState<(AttemptForm & { key: string }) | null>(null);
  const form = useForm<AttemptForm>({ resolver: zodResolver(attemptSchema), defaultValues: { attemptId: "", reason: "" } });

  const onSubmit = form.handleSubmit((v) => {
    correct.reset();
    setPending({ ...v, key: newRequestKey() });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Void an assessment attempt</CardTitle>
        <CardDescription>Use for submitted or expired attempts. Active attempts can&apos;t be voided.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field id={idField} label="Attempt ID" error={form.formState.errors.attemptId?.message}>
            <Input autoComplete="off" spellCheck={false} className="font-mono" {...form.register("attemptId")} />
          </Field>
          <Field id={reasonField} label="Reason" hint="Recorded in the audit log." error={form.formState.errors.reason?.message}>
            <Textarea maxLength={1000} {...form.register("reason")} />
          </Field>
          <div>
            <Button type="submit" variant="danger-outline">
              <Ban className="size-4" aria-hidden /> Void attempt…
            </Button>
          </div>
        </form>
      </CardContent>
      {pending ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => (!o ? setPending(null) : undefined)}
          title="Void this attempt?"
          description={`${VOID_EXPLANATION} The attempt's score is replaced by “voided”.`}
          confirmLabel={correct.isPending ? "Voiding…" : "Void attempt"}
          destructive
          loading={correct.isPending}
          onConfirm={() =>
            correct.mutate(
              { resultType: "attempt", resultId: pending.attemptId, reason: pending.reason, requestKey: pending.key },
              {
                onSuccess: (r) => {
                  setPending(null);
                  form.reset();
                  onDone(r);
                },
              },
            )
          }
        >
          <p className="text-sm">
            Attempt <code className="font-mono break-all">{pending.attemptId}</code>
          </p>
          <MutationError error={correct.error} />
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}

export default function AdminBattlesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const query = useAdminBattles(filter === "all" ? null : filter);
  const correct = useAdminCorrectResult();
  const [target, setTarget] = useState<{ battle: AdminBattleRow; key: string } | null>(null);
  const [result, setResult] = useState<CorrectResultResult | null>(null);

  const columns: Column<AdminBattleRow>[] = [
    { key: "id", header: "Battle", cell: (r) => <CopyableId id={r.id} short /> },
    { key: "mode", header: "Mode", cell: (r) => humanize(r.mode) },
    { key: "state", header: "State", cell: (r) => <BattleStateBadge state={r.state} /> },
    { key: "result", header: "Result", cell: (r) => humanize(r.result_kind) },
    { key: "cancel", header: "Cancel reason", cell: (r) => humanize(r.cancel_reason) },
    { key: "created", header: "Created", cell: (r) => formatDateTime(r.created_at) },
    { key: "finalized", header: "Finalized", cell: (r) => (r.finalized_at ? formatDateTime(r.finalized_at) : "—") },
    {
      key: "actions",
      header: "Actions",
      action: true,
      cell: (r) =>
        r.state === "finished" ? (
          <Button
            size="sm"
            variant="danger-outline"
            onClick={() => {
              correct.reset();
              setTarget({ battle: r, key: newRequestKey() });
            }}
            aria-label={`Void result of battle ${r.id.slice(0, 8)}`}
          >
            Void result
          </Button>
        ) : (
          <span className="text-sm text-ink-muted">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Battles" description="Inspect recent battles and correct results." />
      <Alert tone="info" className="mb-6">
        {VOID_EXPLANATION}
      </Alert>

      <div role="status" aria-live="polite">
        {result ? (
          <div className="mb-6">
            <Compensations result={result} />
          </div>
        ) : null}
      </div>

      <div className="mb-6">
        <FilterSelect label="State" value={filter} onChange={setFilter} options={FILTERS} />
      </div>

      <section aria-label="Battles" className="mb-10">
        {query.isPending ? (
          <LoadingState label="Loading battles…" />
        ) : query.isError ? (
          <AdminErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.length === 0 ? (
          <EmptyState title="No battles" description="Try another state filter." />
        ) : (
          <>
            <DataTable caption="Recent battles" columns={columns} rows={query.data} rowKey={(r) => r.id} />
            {query.data.length >= 100 ? <p className="mt-3 text-sm text-ink-muted">Showing the 100 most recent battles.</p> : null}
          </>
        )}
      </section>

      <VoidAttemptForm onDone={setResult} />

      {target ? (
        <ReasonDialog
          open
          onOpenChange={(o) => (!o ? setTarget(null) : undefined)}
          title="Void this battle result?"
          description={VOID_EXPLANATION}
          confirmLabel="Void result"
          loading={correct.isPending}
          error={correct.error}
          onConfirm={(reason) =>
            correct.mutate(
              { resultType: "battle", resultId: target.battle.id, reason, requestKey: target.key },
              {
                onSuccess: (r) => {
                  setTarget(null);
                  setResult(r);
                },
              },
            )
          }
        >
          <p className="text-sm">
            Battle <code className="font-mono break-all">{target.battle.id}</code> · {humanize(target.battle.result_kind)} ·{" "}
            {formatDateTime(target.battle.finalized_at ?? target.battle.created_at)}
          </p>
        </ReasonDialog>
      ) : null}
    </>
  );
}
