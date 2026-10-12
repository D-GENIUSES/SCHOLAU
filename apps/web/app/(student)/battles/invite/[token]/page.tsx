"use client";

import { Swords } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { isApiError } from "@scholau/api";
import { useAcceptBattle } from "@scholau/api/react";
import { slotBusyHref } from "@/components/battle/action-error";
import { BattleRulesList } from "@/components/battle/rules-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { InlineError } from "@/components/ui/states";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const accept = useAcceptBattle();

  const onAccept = () => {
    accept.mutate({ inviteToken: token }, { onSuccess: (battle) => router.push(`/battles/${battle.battle_id}`) });
  };

  return (
    <div className="mx-auto flex w-full max-w-reading flex-col gap-6">
      <PageHeader eyebrow="Battle invitation" title="You've been challenged" />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Swords className="size-5 text-brand-primary" aria-hidden />
            <CardTitle>A classmate challenged you to a 1v1 battle</CardTitle>
          </div>
          <CardDescription>
            Accept to join their battle in a course you share. You&apos;ll both confirm you&apos;re ready before the questions start.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <BattleRulesList />
          <p className="text-sm text-ink-muted">Invitations last 5 minutes. Battles are unlimited — there&apos;s no daily quota.</p>
          <InviteError error={accept.error} onRetry={accept.retryLast} />
        </CardContent>
        <CardFooter>
          <Button onClick={onAccept} loading={accept.isPending} disabled={accept.isSuccess}>
            Accept challenge
          </Button>
          <Button asChild variant="outline">
            <Link href="/battles">Not now</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function InviteError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (!error) return null;
  if (isApiError(error, "QUEUE_EXPIRED")) {
    return (
      <Alert tone="warning" role="alert" title="Invitation expired">
        This invitation has expired. Invitations last 5 minutes. Ask your classmate to send a new link.
      </Alert>
    );
  }
  if (isApiError(error, "BATTLE_FULL")) {
    return (
      <Alert tone="warning" role="alert" title="This battle can no longer be joined">
        Someone else already joined, or the battle has moved on. You can start your own battle instead.
      </Alert>
    );
  }
  if (isApiError(error, "NOT_ENROLLED")) {
    return (
      <Alert
        tone="warning"
        role="alert"
        title="Enroll in this course first"
        action={
          <Button asChild size="sm" variant="secondary">
            <Link href="/study">Go to study</Link>
          </Button>
        }
      >
        You need to be enrolled in this battle&apos;s course to accept.
      </Alert>
    );
  }
  if (isApiError(error, "FORBIDDEN")) {
    return (
      <Alert
        tone="info"
        role="alert"
        title="This is your own invitation"
        action={
          <Button asChild size="sm" variant="secondary">
            <Link href="/battles">Go to battles</Link>
          </Button>
        }
      >
        Share the link with a classmate — you can&apos;t accept your own challenge.
      </Alert>
    );
  }
  if (isApiError(error, "SLOT_BUSY")) {
    return (
      <Alert
        tone="warning"
        role="alert"
        title="You already have a live battle or queue entry"
        action={
          <Button asChild size="sm">
            <Link href={slotBusyHref(error) ?? "/battles"}>Resume</Link>
          </Button>
        }
      >
        Finish or leave it before accepting this challenge.
      </Alert>
    );
  }
  if (isApiError(error, "NETWORK")) {
    return (
      <Alert
        tone="error"
        role="alert"
        title="We couldn't reach ScholAu"
        action={
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        }
      >
        Check your connection and try again.
      </Alert>
    );
  }
  return <InlineError error={error} />;
}
