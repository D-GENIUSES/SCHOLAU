"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { useAcceptBattle, useBattleInvitations, useDeclineBattleInvitation } from "@scholau/api/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function BattleChallengeAlert() {
  const invitations = useBattleInvitations();
  const accept = useAcceptBattle();
  const decline = useDeclineBattleInvitation();
  const router = useRouter();
  const [alerted, setAlerted] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const incoming = invitations.data?.invitations.find((invite) =>
    !seen.current.has(invite.battle_id)
    && typeof window !== "undefined"
    && !window.sessionStorage.getItem(`scholau.battle-alert.${invite.battle_id}`));

  useEffect(() => {
    if (!incoming || alerted) return;
    seen.current.add(incoming.battle_id);
    window.sessionStorage.setItem(`scholau.battle-alert.${incoming.battle_id}`, "seen");
    setAlerted(incoming.battle_id);
  }, [incoming, alerted]);

  const invite = invitations.data?.invitations.find((item) => item.battle_id === alerted);
  const acceptInvite = () => {
    if (!invite) return;
    accept.mutate({ inviteToken: invite.invite_token }, {
      onSuccess: (battle) => {
        setAlerted(null);
        router.push(`/battles/${battle.battle_id}`);
      },
    });
  };
  const declineInvite = () => {
    if (!invite) return;
    decline.mutate(invite.battle_id, { onSuccess: () => setAlerted(null) });
  };

  return (
    <Dialog open={Boolean(invite)} onOpenChange={(open) => { if (!open) setAlerted(null); }}>
      {invite ? <DialogContent>
        <div className="flex size-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary"><Swords className="size-6" aria-hidden /></div>
        <DialogTitle>You&apos;ve been challenged!</DialogTitle>
        <DialogDescription>{invite.display_name} invited you to a 1v1 battle in {invite.courses.join(" + ")} ({invite.round_count} questions).</DialogDescription>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={accept.isPending || decline.isPending} onClick={declineInvite}>Decline</Button>
          <Button disabled={accept.isPending || decline.isPending} onClick={acceptInvite}>Accept challenge</Button>
        </div>
      </DialogContent> : null}
    </Dialog>
  );
}
