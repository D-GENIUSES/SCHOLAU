"use client";

import { Copy, Share2 } from "lucide-react";
import { useState } from "react";
import type { Battle } from "@scholau/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LiveRegion } from "@/components/ui/misc";
import { InlineError } from "@/components/ui/states";
import { CountdownBar } from "./countdown";
import { useCanShare, useOrigin, useRefetchWhenDue } from "./hooks";

/** Creator's view of an open direct challenge: share link, expiry and cancel. */
export function WaitingPanel({
  battle,
  refetch,
  onCancel,
  cancelling,
  cancelError,
}: {
  battle: Battle;
  refetch: () => unknown;
  onCancel: () => void;
  cancelling: boolean;
  cancelError: unknown;
}) {
  const origin = useOrigin();
  const canShare = useCanShare();
  const remaining = useRefetchWhenDue(battle.invitation_expires_at, refetch);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const link = battle.invite_token && origin ? `${origin}/battles/invite/${battle.invite_token}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: "ScholAu battle", text: "I challenge you to a ScholAu battle!", url: link });
    } catch {
      // Dismissed share sheets reject; the link stays available to copy.
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Waiting for your opponent</CardTitle>
        <CardDescription>
          {battle.invited_user_id ? "Your friend has received an invitation for" : "Share this link with a classmate enrolled in"} {battle.courses?.map((c) => c.code).join(" + ") ?? battle.course?.code ?? "the selected courses"}. The battle starts once they accept and you&apos;re
          both ready.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="font-semibold">{battle.round_count} questions · 10–15 seconds per question</p>
        {battle.invite_token ? (
          <>
            <Field id="invite-link" label="Invitation link" hint={battle.invited_user_id ? "Only your invited friend can accept this link." : "An enrolled classmate with this link can accept. It works once."}>
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => void copy()} disabled={!link}>
                <Copy className="size-5" aria-hidden />
                {copyState === "copied" ? "Copied" : "Copy link"}
              </Button>
              {canShare ? (
                <Button variant="outline" onClick={() => void share()} disabled={!link}>
                  <Share2 className="size-5" aria-hidden />
                  Share
                </Button>
              ) : null}
            </div>
            {copyState === "failed" ? (
              <Alert tone="warning">We couldn&apos;t copy automatically. Select the link above and copy it manually.</Alert>
            ) : null}
            <LiveRegion>{copyState === "copied" ? "Link copied" : ""}</LiveRegion>
          </>
        ) : (
          <p className="text-ink-muted">Waiting for your opponent to join.</p>
        )}
        <CountdownBar
          remainingMs={remaining}
          totalMs={Math.max(5 * 60_000, remaining)}
          label="Invitation expires in"
          warnBelowMs={30_000}
        />
        <InlineError error={cancelError} />
      </CardContent>
      <CardFooter>
        <Button variant="danger-outline" onClick={onCancel} loading={cancelling}>
          Cancel challenge
        </Button>
        <p className="text-sm text-ink-muted">Cancelling before the battle starts awards no XP.</p>
      </CardFooter>
    </Card>
  );
}
