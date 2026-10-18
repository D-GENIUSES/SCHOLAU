"use client";

import { useRouter } from "next/navigation";
import { useAcceptBattle, useBattleInvitations, useDeclineBattleInvitation } from "@scholau/api/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineError } from "@/components/ui/states";

export function InvitationsPanel() {
  const invitations = useBattleInvitations();
  const accept = useAcceptBattle();
  const decline = useDeclineBattleInvitation();
  const router = useRouter();
  if (!invitations.data?.invitations.length) return <InlineError error={invitations.error} />;
  return (
    <Card>
      <CardHeader><CardTitle>Battle invitations</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {invitations.data.invitations.map((invite) => <div key={invite.battle_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-4">
          <div className="min-w-0 flex-1"><p className="font-bold">{invite.display_name} challenges you</p>
            <p className="text-sm">{invite.courses.join(" + ")} · {invite.round_count} questions</p>
            <p className="text-xs text-ink-muted">Reading time, then 5–15 seconds per question · up to {Math.ceil(invite.round_count * 27 / 60)} minutes</p>
          </div>
          <Button disabled={accept.isPending || decline.isPending} onClick={() => accept.mutate({ inviteToken: invite.invite_token }, { onSuccess: (battle) => router.push(`/battles/${battle.battle_id}`) })}>Accept</Button>
          <Button variant="outline" disabled={accept.isPending || decline.isPending} onClick={() => decline.mutate(invite.battle_id)}>Decline</Button>
        </div>)}
        <InlineError error={accept.error ?? decline.error} />
      </CardContent>
    </Card>
  );
}
