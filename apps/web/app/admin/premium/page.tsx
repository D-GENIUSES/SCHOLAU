"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, CheckCircle2, Clock } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { type AdminEntitlementRow, newRequestKey, type PremiumGrantResult } from "@scholau/api";
import { useAdminEntitlements, useAdminGrantPremium, useAdminRevokePremium } from "@scholau/api/react";
import { formatDate, formatDateTime, type GrantPremiumInput, grantPremiumSchema } from "@scholau/core";
import { type Column, DataTable } from "@/components/admin/data-table";
import { AdminErrorState, CopyableId, humanize, MutationError, ReasonDialog } from "@/components/admin/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Badge, PageHeader } from "@/components/ui/misc";
import { EmptyState, LoadingState } from "@/components/ui/states";

type EntitlementStatus = "active" | "expired" | "revoked" | "scheduled";

function entitlementStatus(e: AdminEntitlementRow, now: number): EntitlementStatus {
  if (e.revoked_at) return "revoked";
  if (e.ends_at && new Date(e.ends_at).getTime() <= now) return "expired";
  if (new Date(e.starts_at).getTime() > now) return "scheduled";
  return "active";
}

function EntitlementBadge({ status }: { status: EntitlementStatus }) {
  if (status === "active")
    return (
      <Badge tone="success">
        <CheckCircle2 className="size-3.5" aria-hidden /> Active
      </Badge>
    );
  if (status === "revoked")
    return (
      <Badge tone="danger">
        <Ban className="size-3.5" aria-hidden /> Revoked
      </Badge>
    );
  if (status === "scheduled")
    return (
      <Badge tone="brand">
        <Clock className="size-3.5" aria-hidden /> Scheduled
      </Badge>
    );
  return (
    <Badge tone="neutral">
      <Clock className="size-3.5" aria-hidden /> Expired
    </Badge>
  );
}

/** `YYYY-MM-DD` from a date input → ISO timestamp at the end of that day in the admin's local time zone. */
function endOfDayIso(date: string): string | null {
  const d = new Date(`${date}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function GrantForm() {
  const ids = { user: useId(), ends: useId(), reason: useId() };
  const grant = useAdminGrantPremium();
  const [intent, setIntent] = useState<{ signature: string; key: string } | null>(null);
  const [granted, setGranted] = useState<PremiumGrantResult | null>(null);
  const form = useForm<GrantPremiumInput>({
    resolver: zodResolver(grantPremiumSchema),
    defaultValues: { userId: "", endsAt: "", reason: "" },
  });

  const onSubmit = form.handleSubmit((v) => {
    const endsAt = endOfDayIso(v.endsAt);
    if (!endsAt) {
      form.setError("endsAt", { message: "Choose a valid end date." });
      return;
    }
    const signature = JSON.stringify([v.userId, endsAt, v.reason]);
    const key = intent?.signature === signature ? intent.key : newRequestKey();
    setIntent({ signature, key });
    setGranted(null);
    grant.mutate(
      { userId: v.userId, endsAt, reason: v.reason, requestKey: key },
      {
        onSuccess: (r) => {
          setIntent(null);
          form.reset();
          setGranted(r);
        },
      },
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grant premium</CardTitle>
        <CardDescription>Manual grants for pilots and support. The grant ends at 23:59 on the chosen date (your local time).</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field id={ids.user} label="User ID" error={form.formState.errors.userId?.message}>
            <Input autoComplete="off" spellCheck={false} className="font-mono" {...form.register("userId")} />
          </Field>
          <Field id={ids.ends} label="End date" error={form.formState.errors.endsAt?.message}>
            <Input type="date" className="sm:w-60" {...form.register("endsAt")} />
          </Field>
          <Field id={ids.reason} label="Reason" hint="Recorded in the audit log." error={form.formState.errors.reason?.message}>
            <Textarea maxLength={1000} {...form.register("reason")} />
          </Field>
          <MutationError error={grant.error} />
          <div role="status" aria-live="polite">
            {granted ? (
              <Alert tone="success" title="Premium granted">
                Until {granted.ends_at ? formatDateTime(granted.ends_at) : "no end date"} for user{" "}
                <code className="font-mono break-all">{granted.user_id}</code>.
              </Alert>
            ) : null}
          </div>
          <div>
            <Button type="submit" loading={grant.isPending}>
              Grant premium
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function EntitlementList() {
  const query = useAdminEntitlements();
  const revoke = useAdminRevokePremium();
  const [target, setTarget] = useState<{ row: AdminEntitlementRow; key: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (query.isPending) return <LoadingState label="Loading entitlements…" />;
  if (query.isError) return <AdminErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) return <EmptyState title="No entitlements yet" description="Grants appear here." />;

  const now = query.dataUpdatedAt;
  const columns: Column<AdminEntitlementRow>[] = [
    { key: "user", header: "User", cell: (r) => <CopyableId id={r.user_id} short /> },
    { key: "status", header: "Status", cell: (r) => <EntitlementBadge status={entitlementStatus(r, now)} /> },
    { key: "source", header: "Source", cell: (r) => humanize(r.source) },
    { key: "starts", header: "Starts", cell: (r) => formatDate(r.starts_at) },
    { key: "ends", header: "Ends", cell: (r) => (r.ends_at ? formatDate(r.ends_at) : "No end date") },
    { key: "reason", header: "Reason", cell: (r) => r.reason ?? "—" },
    {
      key: "actions",
      header: "Actions",
      action: true,
      cell: (r) =>
        r.revoked_at ? (
          <span className="text-sm text-ink-muted">Revoked {formatDate(r.revoked_at)}</span>
        ) : (
          <Button
            size="sm"
            variant="danger-outline"
            onClick={() => {
              revoke.reset();
              setNotice(null);
              setTarget({ row: r, key: newRequestKey() });
            }}
            aria-label={`Revoke premium for user ${r.user_id.slice(0, 8)}`}
          >
            Revoke
          </Button>
        ),
    },
  ];

  return (
    <>
      <div role="status" aria-live="polite">
        {notice ? <Alert tone="success" title={notice} className="mb-4" /> : null}
      </div>
      <DataTable caption="Premium entitlements" columns={columns} rows={query.data} rowKey={(r) => r.id} />
      {target ? (
        <ReasonDialog
          open
          onOpenChange={(o) => (!o ? setTarget(null) : undefined)}
          title="Revoke premium?"
          description="The entitlement ends immediately. This doesn't affect battles or XP."
          confirmLabel="Revoke"
          loading={revoke.isPending}
          error={revoke.error}
          onConfirm={(reason) =>
            revoke.mutate(
              { entitlementId: target.row.id, reason, requestKey: target.key },
              {
                onSuccess: (r) => {
                  setTarget(null);
                  setNotice(r.premium ? "Entitlement revoked. The user still has premium from another entitlement." : "Entitlement revoked.");
                },
              },
            )
          }
        >
          <p className="text-sm">
            User <code className="font-mono break-all">{target.row.user_id}</code>
          </p>
        </ReasonDialog>
      ) : null}
    </>
  );
}

export default function AdminPremiumPage() {
  return (
    <>
      <PageHeader eyebrow="Admin" title="Premium" description="Grant and revoke premium entitlements." />
      <Alert tone="info" title="Premium never gates battles or battle XP." className="mb-6">
        Battles stay unlimited for everyone, and every completed battle earns XP regardless of premium.
      </Alert>
      <div className="flex flex-col gap-8">
        <GrantForm />
        <section aria-labelledby="entitlements-heading" className="flex flex-col gap-4">
          <h2 id="entitlements-heading" className="text-xl font-bold">
            Entitlements
          </h2>
          <EntitlementList />
        </section>
      </div>
    </>
  );
}
