"use client";

import Link from "next/link";
import { Check, UserPlus, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { BattleParticipant } from "@scholau/api";
import { useFriendAction, useFriends } from "@scholau/api/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";

export function BattleOpponentFriend({ opponent }: { opponent: BattleParticipant }) {
  const friends = useFriends();
  const action = useFriendAction();
  const client = useQueryClient();
  const person = friends.data?.people.find(person => person.user_id === opponent.user_id);
  if (!opponent.user_id || opponent.is_me || person?.state === "blocked") return null;
  const accepted = person?.state === "accepted";
  const incoming = person?.state === "pending" && person.incoming;
  const sent = person?.state === "pending" && !person.incoming;
  return <section aria-label={`Connect with ${opponent.display_name}`} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={opponent.display_name} path={opponent.avatar_path} size={40} publicProfile />
      <div className="min-w-0">
        <Link href={`/people/${opponent.user_id}`} className="block truncate text-sm font-bold hover:underline" title={opponent.display_name}>{opponent.display_name}</Link>
        <p className="text-xs text-ink-muted">Add them as a friend to challenge them again.</p>
      </div>
    </div>
    <div className="flex shrink-0 flex-col gap-2">
      <Button variant={accepted || sent ? "outline" : "primary"} disabled={friends.isPending || friends.isError || action.isPending || accepted || sent} loading={action.isPending} onClick={() => action.mutate({ userId: opponent.user_id!, action: incoming ? "accept" : "request" }, { onSuccess: state => client.setQueryData(["scholau", "social", "friends"], state) })}>
        {accepted ? <Users size={16} aria-hidden /> : sent ? <Check size={16} aria-hidden /> : <UserPlus size={16} aria-hidden />}
        {friends.isPending ? "Checking friendship…" : accepted ? "Already friends" : sent ? "Request sent" : incoming ? "Accept friend request" : "Add friend"}
      </Button>
      <span role="status" className="sr-only">{accepted ? "You are friends" : sent ? "Friend request sent" : ""}</span>
      <InlineError error={friends.error ?? action.error} />
      {friends.isError ? <Button size="sm" variant="link" onClick={() => void friends.refetch()}>Retry friendship check</Button> : null}
    </div>
  </section>;
}
