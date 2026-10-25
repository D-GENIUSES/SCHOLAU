"use client";

import { useBattleInsights } from "@/lib/admin-insights";
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
import { Dialog, DialogContent, DialogTitle, DialogDescription, ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/shared";
import { Badge } from "@/components/ui/misc";
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
  const [filter, setFilter] = useState<Filter>("finished");
  const query = useAdminBattles(filter === "all" ? null : filter);
  const correct = useAdminCorrectResult();
  const insights = useBattleInsights(query.data?.map(battle => battle.id) ?? []);
  const [details, setDetails] = useState<AdminBattleRow | null>(null);
  const detail = insights.data?.items.find(item => item.id === details?.id);
  const [target, setTarget] = useState<{ battle: AdminBattleRow; key: string } | null>(null);
  const [result, setResult] = useState<CorrectResultResult | null>(null);

  const columns: Column<AdminBattleRow>[] = [
    { key: "players", header: "Match", cell: r => {const match = insights.data?.items.find(item => item.id === r.id); return <div><p className="font-semibold">{match?.players.map(player => player.name).join(" vs ") || "Players unavailable"}{match?.players.length === 1 ? " vs Awaiting opponent" : ""}</p><p className="text-xs text-ink-muted">{match?.course ?? "Battle"} · {humanize(r.mode)}</p></div>;} },
    { key: "score", header: "Score", cell: r => {const match = insights.data?.items.find(item => item.id === r.id);return <span className="font-bold tabular-nums">{match?.players.map(player => player.score ?? "—").join(" : ") || "—"}</span>;} },
    { key: "state", header: "Status", cell: r => <BattleStateBadge state={r.state} /> },
    { key: "created", header: "Date", cell: r => formatDateTime(r.finalized_at ?? r.created_at) },
    { key: "info", header: "Information", action: true, cell: r => <Button variant="outline" size="sm" onClick={() => setDetails(r)}>More information</Button> },
  ];

  return (
    <>
      <AdminPageHeader title="Battles" description="Inspect recent battles and correct results." />
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

      {insights.isError && <Alert tone="warning">Player names and scores could not be loaded. <Button variant="ghost" onClick={() => void insights.refetch()}>Retry</Button></Alert>}
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

      <details className="rounded-control border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">Assessment corrections</summary><div className="mt-3"><VoidAttemptForm onDone={setResult} /></div></details>
      <Dialog open={Boolean(details)} onOpenChange={open => {if(!open) setDetails(null);}}><DialogContent className="max-w-lg"><DialogTitle>Battle information</DialogTitle><DialogDescription>{detail?.players.map(player => player.name).join(" vs ") || "Match details"}</DialogDescription>{details && <><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-ink-muted">Course</dt><dd>{detail?.course ?? "—"}</dd></div><div><dt className="text-ink-muted">Rounds</dt><dd>{detail?.rounds ?? "—"}</dd></div><div><dt className="text-ink-muted">Result</dt><dd>{humanize(details.result_kind)}</dd></div><div><dt className="text-ink-muted">Status</dt><dd>{humanize(details.state)}</dd></div></dl>{detail?.players.map(player => <p key={player.id} className="flex justify-between gap-2 border-t border-line py-2 text-sm"><span>{player.name}{detail.winner_id === player.id ? " · Winner" : ""}{player.forfeited ? " · Forfeited" : ""}</span><strong>{player.score ?? "—"} correct</strong></p>)}<details className="text-xs"><summary className="cursor-pointer">Technical details</summary><div className="mt-2 space-y-2"><CopyableId id={details.id}/><p>Created: {formatDateTime(details.created_at)}</p><p>Finalized: {details.finalized_at ? formatDateTime(details.finalized_at) : "Pending"}</p><p>Cancel reason: {humanize(details.cancel_reason)}</p></div></details>{details.state === "finished" && <Button size="sm" variant="danger-outline" onClick={() => { correct.reset(); setTarget({battle:details,key:newRequestKey()}); setDetails(null); }}>Void result</Button>}</>}</DialogContent></Dialog>

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
