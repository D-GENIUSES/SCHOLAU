"use client";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { useState } from "react";
import type { FriendAction, FriendPerson } from "@scholau/api";
import { useFriendAction, useFriends, useSearchFriends, useSetFriendUsername } from "@scholau/api/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InlineError, LoadingState } from "@/components/ui/states";
import { suggestUsernames, UsernameSuggestions } from "@/components/auth/username-suggestions";
export function FriendsPanel() {
  const friends = useFriends();
  const action = useFriendAction();
  const username = useSetFriendUsername();
  const [name, setName] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const results = useSearchFriends(query);
  const people = friends.data?.people ?? [];
  const busy = action.isPending;
  const act = (person: FriendPerson, value: FriendAction) => action.mutate({ userId: person.user_id, action: value });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Friends</CardTitle>
        <CardDescription>Add classmates and invite them to your next battle.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {friends.isPending ? <LoadingState label="Loading friendsÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦" /> : null}
        <InlineError error={friends.error} />
        {friends.data ? <p className="break-all text-sm">Your username: <strong>@{friends.data.username}</strong></p> : null}
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
          event.preventDefault(); username.mutate(name.trim(), {
            onSuccess: () => { setName(""); setSuggestions([]); },
            onError: (error) => { if (error.field_errors?.username) void suggestUsernames(name).then(setSuggestions); },
          });
        }}>
          <label className="min-w-0 flex-1 text-sm font-semibold">Choose your username
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="your_username" minLength={3} maxLength={24} pattern="[a-zA-Z][a-zA-Z0-9_]{2,23}" required autoCapitalize="none" autoCorrect="off" />
          </label>
          <Button type="submit" variant="outline" loading={username.isPending}>Save</Button>
        </form>
        {username.isSuccess ? <p role="status" className="text-sm text-success">Username saved.</p> : null}
        <InlineError error={username.error} />
        <UsernameSuggestions names={suggestions} onChoose={(value) => { setName(value); username.reset(); setSuggestions([]); }} />
        <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); }}>
          <label className="min-w-0 flex-1 text-sm font-semibold">Find friends
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or username" minLength={3} maxLength={60} required />
          </label>
          <Button type="submit" variant="outline" loading={results.isFetching}>Search</Button>
        </form>
        <InlineError error={results.error} />
        {query.length >= 3 && results.isSuccess ? (
          <section aria-label="Search results" className="flex flex-col gap-2">
            <p className="text-sm font-semibold">{results.data.people.length ? "Search results" : "No users found."}</p>
            {results.data.people.map((person) => <PersonRow key={person.user_id} person={person} busy={busy} onAction={(value) => act(person, value)} />)}
          </section>
        ) : null}
        <section aria-label="Friends and requests" className="flex flex-col gap-2">
          {people.length === 0 && friends.isSuccess ? <p className="text-sm text-ink-muted">Your friends and requests will appear here.</p> : null}
          {people.map((person) => <PersonRow key={person.user_id} person={person} busy={busy} onAction={(value) => act(person, value)} />)}
        </section>
        <InlineError error={action.error} />
      </CardContent>
    </Card>
  );
}
function PersonRow({ person, busy, onAction }: { person: FriendPerson; busy: boolean; onAction: (value: FriendAction) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
      <Link href={`/people/${person.user_id}`} aria-label={`View ${person.display_name}'s public profile`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-brand-primary">
        <Avatar name={person.display_name} path={person.avatar_path} publicProfile />
        <div className="min-w-0"><p className="truncate font-semibold hover:underline">{person.display_name}</p>
        <p className="break-all text-xs text-ink-muted">@{person.username} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {person.state === "accepted" ? "Friend" : person.state === "pending" ? person.incoming ? "Wants to add you" : "Request sent" : person.state === "blocked" ? "Blocked" : "Add a friend"}</p></div>
      </Link>
      <div className="flex flex-wrap gap-2">
        {!person.state ? <Button size="sm" disabled={busy} onClick={() => onAction("request")}>Add friend</Button> : null}
        {person.state === "pending" && person.incoming ? <Button size="sm" disabled={busy} onClick={() => onAction("accept")}>Accept</Button> : null}
        {person.state === "pending" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction(person.incoming ? "decline" : "cancel")}>{person.incoming ? "Decline" : "Cancel request"}</Button> : null}
        {person.state === "accepted" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("remove")}>Remove</Button> : null}
        {person.state !== "blocked" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("block")}>Block</Button> : <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("unblock")}>Unblock</Button>}
      </div>
    </div>
  );
}
