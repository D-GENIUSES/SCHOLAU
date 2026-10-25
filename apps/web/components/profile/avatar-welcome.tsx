"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useProfile } from "@scholau/api/react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProfilePhotoEditor } from "./profile-photo-editor";

/** Offered once per account, after the notification prompt has finished. */
export function AvatarWelcome({ owner, ready }: { owner: string; ready: boolean }) {
  const profile = useProfile();
  const [editing, setEditing] = useState(false);
  const status = useQuery({
    queryKey: ["scholau", "avatar-setup", owner],
    enabled: ready && profile.data?.id === owner,
    queryFn: async () => {
      const result = await getBrowserSupabase().rpc("get_avatar_setup_v1");
      if (result.error) throw result.error;
      return result.data as { completed: boolean };
    },
    retry: 1,
    staleTime: Infinity,
  });
  const complete = useMutation({
    mutationFn: async () => {
      const result = await getBrowserSupabase().rpc("complete_avatar_setup_v1");
      if (result.error) throw result.error;
    },
    onSuccess: () => { status.refetch(); },
  });
  const open = ready && profile.data?.id === owner && status.data?.completed === false && !complete.isSuccess;
  function finish() { if (!editing && !complete.isPending) complete.mutate(); }

  return <Dialog open={open} onOpenChange={next => { if (!next) finish(); }}>
    <DialogContent hideClose className="avatar-welcome-dialog" onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (editing || complete.isPending) event.preventDefault(); }}>
      <div className="avatar-welcome-heading">
        <span className="avatar-welcome-eyebrow">WELCOME TO SCHOLAU</span>
        <DialogTitle>Make it yours</DialogTitle>
        <DialogDescription>Keep your avatar, pick another, or upload a photo.</DialogDescription>
      </div>
      {profile.data ? <ProfilePhotoEditor profile={profile.data} onboarding onInteractionChange={setEditing} /> : null}
      <div className="avatar-welcome-footer">
        {complete.isError ? <p role="alert">Couldn’t continue. Please try again.</p> : null}
        <Button className="w-full" disabled={editing} loading={complete.isPending} onClick={finish}>Continue</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
