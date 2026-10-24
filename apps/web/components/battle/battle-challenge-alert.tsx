"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  useEffect(() => {
    const items = invitations.data?.invitations;
    if (!items) return;
    if (alerted && items.some((item) => item.battle_id === alerted)) return;
    const incoming = items.find((item) => {
      if (seen.current.has(item.battle_id)) return false;
      try { return !window.sessionStorage.getItem(`scholau.battle-alert.${item.battle_id}`); }
      catch { return true; }
    });
    if (!incoming) { setAlerted(null); return; }
    seen.current.add(incoming.battle_id);
    try { window.sessionStorage.setItem(`scholau.battle-alert.${incoming.battle_id}`, "seen"); }
    catch { /* In-memory tracking also works when browser storage is unavailable. */ }
    setAlerted(incoming.battle_id);
  }, [invitations.data, alerted]);

  const invite = invitations.data?.invitations.find((item) => item.battle_id === alerted);
  const acceptInvite = () => {
    if (!invite) return;
    decline.reset();
    accept.mutate({ inviteToken: invite.invite_token }, {
      onSuccess: (battle) => {
        setAlerted(null);
        router.push(`/battles/${battle.battle_id}`);
      },
    });
  };
  const declineInvite = () => {
    if (!invite) return;
    accept.reset();
    decline.mutate(invite.battle_id, { onSuccess: () => setAlerted(null) });
  };

  return (
    <Dialog open={Boolean(invite)} onOpenChange={(open) => { if (!open) setAlerted(null); }}>
      {invite ? <DialogContent>
        <DialogTitle>Battle invitation</DialogTitle>
        <DialogDescription>{invite.display_name} invited you to a 1v1 battle in {invite.courses.join(" + ")} ({invite.round_count} questions).</DialogDescription>
        {accept.error || decline.error ? <p role="alert" className="text-sm text-destructive">{(accept.error || decline.error)?.message || "Could not respond. Please try again."}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={accept.isPending || decline.isPending} onClick={declineInvite}>Decline</Button>
          <Button disabled={accept.isPending || decline.isPending} onClick={acceptInvite}>{accept.isPending ? "Joining battle..." : "Accept challenge"}</Button>
        </div>
      </DialogContent> : null}
    </Dialog>
  );
}
