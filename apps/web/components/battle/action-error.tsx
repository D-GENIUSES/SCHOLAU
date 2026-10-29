"use client";

import Link from "next/link";
import { isApiError } from "@scholau/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";

function idFrom(fields: Record<string, unknown> | undefined, key: string): string | null {
  const v = fields?.[key];
  return typeof v === "string" && v ? v : null;
}

/** Resume target for a SLOT_BUSY error (`field_errors.battle_id` / `field_errors.queue_id`). */
export function slotBusyHref(error: unknown): string | null {
  if (!isApiError(error, "SLOT_BUSY")) return null;
  if (error.field_errors?.opponent_status) return null;
  const battleId = idFrom(error.field_errors, "battle_id");
  if (battleId) return `/battles/${battleId}`;
  if (idFrom(error.field_errors, "queue_id")) return "/battles/queue";
  return "/battles";
}

/** Battle start/accept errors with recovery actions. */
export function BattleActionError({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  if (isApiError(error, "SLOT_BUSY") && error.field_errors?.opponent_status) {
    return <Alert tone="warning" role="alert" className={className}
      title={error.field_errors.opponent_status === "queue" ? "This learner is already finding an opponent" : "This learner is already in another battle"}>
      Your challenge wasn&apos;t sent. Choose someone else or try again later.
    </Alert>;
  }
  if (isApiError(error, "SLOT_BUSY")) {
    const href = slotBusyHref(error) ?? "/battles";
    const toQueue = href === "/battles/queue";
    return (
      <Alert
        tone="warning"
        role="alert"
        className={className}
        title="You already have a live battle or queue entry"
        action={
          <Button asChild size="sm">
            <Link href={href}>{toQueue ? "Return to the queue" : "Resume battle"}</Link>
          </Button>
        }
      >
        Finish or leave it before starting another one.
      </Alert>
    );
  }
  if (isApiError(error, "CONTENT_UNAVAILABLE")) {
    return (
      <Alert tone="warning" role="alert" className={className} title="Not enough questions yet">
        This course doesn&apos;t have enough battle questions yet. Try another course or keep studying.
      </Alert>
    );
  }
  if (isApiError(error, "NOT_ENROLLED")) {
    return (
      <Alert
        tone="warning"
        role="alert"
        className={className}
        title="Enroll in this course first"
        action={
          <Button asChild size="sm" variant="secondary">
            <Link href="/home">Go to Home</Link>
          </Button>
        }
      >
        You can only battle in courses you&apos;re enrolled in.
      </Alert>
    );
  }
  return <InlineError error={error} className={className} />;
}
