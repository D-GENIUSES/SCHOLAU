"use client";

import { ArrowLeft, LogOut, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { Battle } from "@scholau/api";
import { COPY } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { InlineError } from "@/components/ui/states";

const STATE_LABEL: Record<Battle["state"], string> = {
  waiting: "Waiting for opponent",
  ready: "Get ready",
  countdown: "Starting",
  active: "In progress",
  finished: "Finished",
  cancelled: "Cancelled",
  voided: "Voided",
};

export function BattleTopBar({
  battle,
  live,
  onLeave,
}: {
  battle: Battle | undefined;
  live: boolean;
  onLeave: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xl font-bold tracking-tight sm:text-2xl">{battle?.state === "active" ? "Live battle" : "Battle"}</p>
        {battle ? <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">{battle.state === "active" ? <span className="size-1.5 rounded-full bg-success" aria-hidden /> : null}{STATE_LABEL[battle.state]}</p> : null}
      </div>
      {live ? (
        <Button variant="outline" size="sm" onClick={onLeave}>
          <LogOut className="size-4" aria-hidden /> Leave
        </Button>
      ) : (
        <Button asChild variant="ghost" size="sm">
          <Link href="/battles">
            <ArrowLeft className="size-4" aria-hidden /> Battles
          </Link>
        </Button>
      )}
    </div>
  );
}

export function LeaveBattleDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
  error: unknown;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Leave this battle?"
      description={COPY.battle.leaveWarning}
      confirmLabel={loading ? "Leaving…" : "Leave battle"}
      cancelLabel="Stay"
      onConfirm={onConfirm}
      destructive
      loading={loading}
    >
      <InlineError error={error} />
    </ConfirmDialog>
  );
}

export function ReconnectBanner({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <Alert
      tone="warning"
      role="status"
      title={COPY.battle.reconnecting}
      action={
        <Button size="sm" variant="secondary" onClick={onRefresh} loading={refreshing}>
          {refreshing ? null : <RefreshCw className="size-4" aria-hidden />}
          Refresh
        </Button>
      }
    />
  );
}
