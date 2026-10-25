"use client";

import { Archive, Send, SendHorizontal } from "lucide-react";
import { type ReactNode, useState } from "react";
import { newRequestKey } from "@scholau/api";
import { useAdminPublish, useAdminRetire } from "@scholau/api/react";
import type { AdminEntityType, ContentStatus } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { MutationError, ReasonDialog } from "./shared";

export const IMMUTABLE_WARNING =
  "Published versions can't be edited. To change content later, import a new draft version and retire this one.";

type RetirableEntity = Exclude<AdminEntityType, "battle_rules">;

/** Publish (draft) and retire actions for one entity; one request key per opened dialog. */
export function PublishActions({
  entityType,
  id,
  status,
  label,
  canRetire,
  publishDescription,
  publishDetails,
  retireDescription,
  retiredNote = "Retired versions can't be republished. Import a new draft instead.",
  onDone,
  size = "md",
}: {
  entityType: RetirableEntity;
  id: string;
  status: ContentStatus;
  label: string;
  canRetire: boolean;
  publishDescription: string;
  publishDetails?: ReactNode;
  retireDescription: string;
  retiredNote?: string;
  onDone: (message: string) => void;
  size?: "md" | "sm";
}) {
  const publish = useAdminPublish();
  const retire = useAdminRetire();
  const [dialog, setDialog] = useState<{ type: "publish" | "retire"; key: string } | null>(null);

  const open = (type: "publish" | "retire") => {
    publish.reset();
    retire.reset();
    setDialog({ type, key: newRequestKey() });
  };
  const close = (o: boolean) => {
    if (!o) setDialog(null);
  };

  if (status === "retired") return <p className="text-sm text-ink-muted">{retiredNote}</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" ? (
        <Button size={size} onClick={() => open("publish")} aria-label={`Publish ${label}`}>
          <Send className="size-4" aria-hidden /> Publish
        </Button>
      ) : null}
      {canRetire ? (
        <Button size={size} variant="danger-outline" onClick={() => open("retire")} aria-label={`Retire ${label}`}>
          <Archive className="size-4" aria-hidden /> Retire
        </Button>
      ) : null}

      {dialog?.type === "publish" ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`Publish ${label}?`}
          description={publishDescription}
          confirmLabel={publish.isPending ? "Publishing…" : "Publish"}
          loading={publish.isPending}
          onConfirm={() =>
            publish.mutate(
              { entityType, id, requestKey: dialog.key },
              {
                onSuccess: (r) => {
                  setDialog(null);
                  onDone(r.already_published ? `${label} was already published.` : `${label} published.`);
                },
              },
            )
          }
        >
          {publishDetails ? <div className="flex flex-col gap-2 text-sm">{publishDetails}</div> : null}
          <MutationError error={publish.error} />
        </ConfirmDialog>
      ) : null}

      {dialog?.type === "retire" ? (
        <ReasonDialog
          open
          onOpenChange={close}
          title={`Retire ${label}?`}
          description={retireDescription}
          confirmLabel="Retire"
          loading={retire.isPending}
          error={retire.error}
          onConfirm={(reason) =>
            retire.mutate(
              { entityType, id, reason, requestKey: dialog.key },
              {
                onSuccess: (r) => {
                  setDialog(null);
                  onDone(r.retired ? `${label} retired.` : `${label} was not changed — it may already be retired.`);
                },
              },
            )
          }
        />
      ) : null}
    </div>
  );
}

type BulkEntity = Exclude<AdminEntityType, "battle_rules" | "course_offering">;

/** Publish every draft id on the current review tab; one request key per item (stable while the dialog is open). */
export function PublishAllButton({
  entityType,
  ids,
  noun,
  onDone,
}: {
  entityType: BulkEntity;
  ids: string[];
  noun: string;
  onDone: (message: string) => void;
}) {
  const publish = useAdminPublish();
  const [dialog, setDialog] = useState<{ keys: Record<string, string> } | null>(null);
  const [summary, setSummary] = useState<{ published: number; skipped: number; failed: number; lastError: unknown } | null>(
    null,
  );

  if (ids.length === 0) return null;

  const open = () => {
    publish.reset();
    setSummary(null);
    const keys = Object.fromEntries(ids.map((id) => [id, newRequestKey()]));
    setDialog({ keys });
  };
  const close = (o: boolean) => {
    if (!o) {
      setDialog(null);
      setSummary(null);
    }
  };

  const run = async () => {
    if (!dialog) return;
    let published = 0;
    let skipped = 0;
    let failed = 0;
    let lastError: unknown = null;
    for (const id of ids) {
      try {
        const r = await publish.mutateAsync({ entityType, id, requestKey: dialog.keys[id]! });
        if (r.already_published) skipped += 1;
        else published += 1;
      } catch (e) {
        failed += 1;
        lastError = e;
      }
    }
    setSummary({ published, skipped, failed, lastError });
    if (failed === 0) {
      setDialog(null);
      const parts = [`${published} published.`];
      if (skipped > 0) parts.push(`${skipped} already published.`);
      onDone(`Bulk publish complete — ${parts.join(" ")}`);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={open} aria-label={`Publish all ${ids.length} ${noun}`}>
        <SendHorizontal className="size-4" aria-hidden /> Publish all ({ids.length})
      </Button>

      {dialog ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`Publish all ${ids.length} ${noun}?`}
          description={IMMUTABLE_WARNING}
          confirmLabel={publish.isPending ? "Publishing…" : `Publish all (${ids.length})`}
          loading={publish.isPending}
          onConfirm={() => void run()}
        >
          <div className="flex flex-col gap-2 text-sm">
            <p>Each item is published with the same validations as individual publish. Already-published items are skipped.</p>
            <p>Publishing records you as the reviewer for each version.</p>
          </div>
          {summary && summary.failed > 0 ? (
            <Alert
              tone="error"
              title={`${summary.failed} failed — ${summary.published} published, ${summary.skipped} skipped`}
              className="mt-2"
            />
          ) : null}
          <MutationError error={summary?.lastError ?? publish.error} />
        </ConfirmDialog>
      ) : null}
    </>
  );
}
