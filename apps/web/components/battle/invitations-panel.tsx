"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAcceptBattle, useBattleInvitations, useDeclineBattleInvitation } from "@scholau/api/react";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { InlineError } from "@/components/ui/states";

export function InvitationsPanel() {
  const invitations = useBattleInvitations();
  const accept = useAcceptBattle();
  const decline = useDeclineBattleInvitation();
  const router = useRouter();
  const [alerted, setAlerted] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const incoming = invitations.data?.invitations.find((invite) => !seen.current.has(invite.battle_id) && typeof window !== "undefined" && !window.sessionStorage.getItem(`scholau.battle-alert.${invite.battle_id}`));
  useEffect(() => {
    if (!incoming || alerted) return;
    seen.current.add(incoming.battle_id);
    window.sessionStorage.setItem(`scholau.battle-alert.${incoming.battle_id}`, "seen");
    setAlerted(incoming.battle_id);
  }, [incoming, alerted]);
  const alertInvitation = invitations.data?.invitations.find((invite) => invite.battle_id === alerted);
  const acceptInvitation = (inviteToken: string) => accept.mutate({ inviteToken }, { onSuccess: (battle) => { setAlerted(null); router.push(`/battles/${battle.battle_id}`); } });
  const declineInvitation = (battleId: string) => decline.mutate(battleId, { onSuccess: () => setAlerted(null) });
  if (!invitations.data?.invitations.length) return <><Dialog open={Boolean(alertInvitation)} onOpenChange={(open) => { if (!open) setAlerted(null); }}>{alertInvitation ? <DialogContent><DialogTitle>You&apos;ve been challenged!</DialogTitle><DialogDescription>{alertInvitation.display_name} invited you to a 1v1 battle in {alertInvitation.courses.join(" + ")} ({alertInvitation.round_count} questions).</DialogDescription><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => declineInvitation(alertInvitation.battle_id)}>Decline</Button><Button disabled={accept.isPending || decline.isPending} onClick={() => acceptInvitation(alertInvitation.invite_token)}>Accept challenge</Button></div></DialogContent> : null}</Dialog><InlineError error={invitations.error} /></>;
  return (
    <>
    <Dialog open={Boolean(alertInvitation)} onOpenChange={(open) => { if (!open) setAlerted(null); }}>
      {alertInvitation ? <DialogContent>
        <div className="flex size-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary"><Swords className="size-6" aria-hidden /></div>
        <DialogTitle>You&apos;ve been challenged!</DialogTitle>
        <DialogDescription>{alertInvitation.display_name} invited you to a 1v1 battle in {alertInvitation.courses.join(" + ")} ({alertInvitation.round_count} questions).</DialogDescription>
        <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={accept.isPending || decline.isPending} onClick={() => declineInvitation(alertInvitation.battle_id)}>Decline</Button><Button disabled={accept.isPending || decline.isPending} onClick={() => acceptInvitation(alertInvitation.invite_token)}>Accept challenge</Button></div>
      </DialogContent> : null}
    </Dialog>
    <Card className="border-brand-primary/25">
      <CardHeader><CardTitle>Battle challenges</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {invitations.data.invitations.map((invite) => <div key={invite.battle_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-primary/25 p-3">
          <div className="min-w-0 flex-1"><p className="font-bold">{invite.display_name} has challenged you to a battle</p>
            <p className="text-sm">{invite.courses.join(" + ")} · {invite.round_count} questions</p>
            <p className="text-xs text-ink-muted">Reading time, then 5–15 seconds per question · up to {Math.ceil(invite.round_count * 27 / 60)} minutes</p>
          </div>
          <Button disabled={accept.isPending || decline.isPending} onClick={() => acceptInvitation(invite.invite_token)}>Accept</Button>
          <Button variant="outline" disabled={accept.isPending || decline.isPending} onClick={() => declineInvitation(invite.battle_id)}>Decline</Button>
        </div>)}
        <InlineError error={accept.error ?? decline.error} />
      </CardContent>
    </Card>
    </>
  );
}
