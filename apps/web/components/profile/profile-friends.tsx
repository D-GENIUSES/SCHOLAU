"use client";

import Link from "next/link";
import { useState } from "react";
import type { FriendPerson } from "@scholau/api";
import { useFriendAction, useFriends } from "@scholau/api/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, InlineError, LoadingState } from "@/components/ui/states";

export function ProfileFriends() {
  const friends = useFriends();
  const action = useFriendAction();
  const [notice, setNotice] = useState<string | null>(null);

  if (friends.isPending) return <LoadingState variant="list" label="Loading friends…" lines={4} />;
  if (friends.isError) return <ErrorState error={friends.error} onRetry={() => void friends.refetch()} />;

  const people = friends.data.people;
  const requests = people.filter((person) => person.state === "pending" && person.incoming);
  const accepted = people.filter((person) => person.state === "accepted").sort((a, b) => a.display_name.localeCompare(b.display_name));

  const respond = (person: FriendPerson, value: "accept" | "decline") => {
    setNotice(null);
    action.mutate(
      { userId: person.user_id, action: value },
      { onSuccess: () => setNotice(value === "accept" ? `You and ${person.display_name} are now friends.` : `Request from ${person.display_name} declined.`) },
    );
  };

  return (
    <div className="grid max-w-[720px] gap-4">
      {notice ? <p role="status" className="text-sm font-medium text-success">{notice}</p> : null}
      <InlineError error={action.error} />
      <Card>
        <CardHeader>
          <CardTitle>Friend requests{requests.length ? ` (${requests.length})` : ""}</CardTitle>
          <p className="text-sm text-ink-muted">Accept or decline people who want to connect with you.</p>
        </CardHeader>
        <CardContent>
          {requests.length ? (
            <ul className="divide-y divide-line">
              {requests.map((person) => {
                const pending = action.isPending && action.variables?.userId === person.user_id;
                return (
                  <li key={person.user_id} className="flex flex-wrap items-center gap-3 py-3 first:pt-1 last:pb-0">
                    <PersonLink person={person} />
                    <div className="ml-auto flex shrink-0 gap-2">
                      <Button size="sm" loading={pending && action.variables?.action === "accept"} disabled={action.isPending} onClick={() => respond(person, "accept")}>Accept</Button>
                      <Button size="sm" variant="outline" loading={pending && action.variables?.action === "decline"} disabled={action.isPending} onClick={() => respond(person, "decline")}>Decline</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-2 text-sm text-ink-muted">No friend requests right now.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Friends{accepted.length ? ` (${accepted.length})` : ""}</CardTitle>
          <p className="text-sm text-ink-muted">People you are connected with on ScholAu.</p>
        </CardHeader>
        <CardContent>
          {accepted.length ? (
            <ul className="divide-y divide-line">
              {accepted.map((person) => (
                <li key={person.user_id} className="py-3 first:pt-1 last:pb-0">
                  <PersonLink person={person} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-2">
              <p className="font-semibold">No friends yet</p>
              <p className="mt-1 text-sm text-ink-muted">Find classmates and send a friend request from their profile.</p>
              <Button asChild variant="link" className="mt-3"><Link href="/people">Find people</Link></Button>
            </div>
          )}
          {accepted.length ? <Button asChild variant="link" className="mt-4"><Link href="/people">Find people</Link></Button> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function PersonLink({ person }: { person: FriendPerson }) {
  return (
    <Link href={`/people/${person.user_id}`} className="flex min-w-0 flex-1 basis-40 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-brand-primary">
      <Avatar name={person.display_name} path={person.avatar_path} size={40} publicProfile />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{person.display_name}</span>
        {person.username ? <span className="block truncate text-xs text-ink-muted">@{person.username}</span> : null}
      </span>
    </Link>
  );
}
