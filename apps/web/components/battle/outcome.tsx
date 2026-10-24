import type { BattleCancelReason, BattleOutcome } from "@scholau/core";
import { Badge } from "@/components/ui/misc";

const OUTCOME = {
  win: { label: "Win", tone: "success" },
  loss: { label: "Loss", tone: "danger" },
  draw: { label: "Draw", tone: "brand" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  voided: { label: "Voided", tone: "warning" },
  in_progress: { label: "In progress", tone: "brand" },
} as const;

export function outcomeLabel(outcome: BattleOutcome): string {
  return OUTCOME[outcome].label;
}

export function OutcomeBadge({ outcome, className }: { outcome: BattleOutcome; className?: string }) {
  const o = OUTCOME[outcome];
  return (
    <Badge tone={o.tone} className={className}>
      {o.label}
    </Badge>
  );
}

export const CANCEL_REASON_COPY: Record<BattleCancelReason, string> = {
  invite_expired: "The invitation expired before anyone joined.",
  ready_timeout: "Both players weren't ready in time.",
  pre_start_cancel: "The battle was cancelled before it started.",
  early_forfeit: "A player left the battle.",
  content_unavailable: "There weren't enough battle questions for this course.",
  admin_void: "This battle was cancelled by an administrator.",
};

export function cancelReasonCopy(reason: BattleCancelReason | null | undefined): string {
  return reason ? CANCEL_REASON_COPY[reason] : "This battle was cancelled.";
}
