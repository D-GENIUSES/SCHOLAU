"use client";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { useState } from "react";
import type { FriendAction, FriendPerson } from "@scholau/api";
import { useFriendAction, useFriends, useSearchFriends, useSetFriendUsername } from "@scholau/api/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineError, LoadingState } from "@/components/ui/states";
import { suggestUsernames, UsernameSuggestions } from "@/components/auth/username-suggestions";
export function FriendsPanel() {
  const friends = useFriends();
  const action = useFriendAction();
  const username = useSetFriendUsername();
  const [editingUsername, setEditingUsername] = useState(false);
  const [name, setName] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const results = useSearchFriends(query);
  const people = friends.data?.people ?? [];
  const busy = action.isPending;
  const act = (person: FriendPerson, value: FriendAction) => action.mutate({ userId: person.user_id, action: value });
  return (
    <div className="flex min-w-0 flex-col gap-3">
        {friends.isPending ? <LoadingState label="Loading friends…" /> : null}
        <InlineError error={friends.error} />
        {friends.data ? <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-ink-muted">
          <span className="truncate" title={`@${friends.data.username}`}>@{friends.data.username}</span>
          <Button size="sm" variant="link" aria-expanded={editingUsername} onClick={() => setEditingUsername(!editingUsername)}>{editingUsername ? "Done" : "Edit username"}</Button>
        </div> : null}
        <div hidden={!editingUsername && Boolean(friends.data?.username)}>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
          event.preventDefault(); username.mutate(name.trim(), {
            onSuccess: () => { setName(""); setSuggestions([]); setEditingUsername(false); },
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
        </div>
        <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); }}>
          <label className="min-w-0 flex-1 text-sm font-semibold">Find friends
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or username" minLength={3} maxLength={60} required />
          </label>
          <Button type="submit" variant="outline" loading={results.isFetching}>Search</Button>
        </form>
        <InlineError error={results.error} />
        {query.length >= 3 && results.isSuccess ? (
          <section aria-label="Search results" className="flex flex-col divide-y divide-line">
            <p className="text-sm font-semibold">{results.data.people.length ? "Search results" : "No users found."}</p>
            {results.data.people.map((person) => <PersonRow key={person.user_id} person={person} busy={busy} onAction={(value) => act(person, value)} />)}
          </section>
        ) : null}
        <section aria-label="Friends and requests" className="flex flex-col divide-y divide-line">
          {people.length === 0 && friends.isSuccess ? <p className="text-sm text-ink-muted">Your friends and requests will appear here.</p> : null}
          {[
            { label: "Requests", items: people.filter(person => person.state === "pending" && person.incoming) },
            { label: "Friends", items: people.filter(person => person.state === "accepted") },
            { label: "Sent requests", items: people.filter(person => person.state === "pending" && !person.incoming) },
            { label: "Blocked", items: people.filter(person => person.state === "blocked") },
          ].filter(group => group.items.length > 0).map(group => <div key={group.label} className="py-2">
            <h3 className="flex items-center gap-2 pb-1 text-xs font-semibold text-ink-muted">{group.label}<span className="rounded-full bg-surface-page px-1.5 tabular-nums">{group.items.length}</span></h3>
            <div className="divide-y divide-line">{group.items.map(person => <PersonRow key={person.user_id} person={person} busy={busy} onAction={value => act(person, value)} />)}</div>
          </div>)}
        </section>
        <InlineError error={action.error} />
    </div>
  );
}
function PersonRow({ person, busy, onAction }: { person: FriendPerson; busy: boolean; onAction: (value: FriendAction) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const secondary: { label: string; action: FriendAction }[] = [
    ...(person.state === "pending" ? [{ label: person.incoming ? "Decline request" : "Cancel request", action: (person.incoming ? "decline" : "cancel") as FriendAction }] : []),
    ...(person.state === "accepted" ? [{ label: "Remove friend", action: "remove" as FriendAction }] : []),
    { label: person.state === "blocked" ? "Unblock" : "Block", action: person.state === "blocked" ? "unblock" : "block" },
  ];
  return (
    <div className="flex min-w-0 items-center gap-2 py-2">
      <Link href={`/people/${person.user_id}`} aria-label={`View ${person.display_name}'s public profile`} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-brand-primary">
        <Avatar name={person.display_name} path={person.avatar_path} size={32} publicProfile />
        <div className="min-w-0"><p className="truncate text-sm font-semibold hover:underline" title={person.display_name}>{person.display_name}</p>
          <p className="truncate text-xs text-ink-muted" title={`@${person.username}`}>@{person.username}</p></div>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        {!person.state ? <Button size="sm" className="px-3" disabled={busy} onClick={() => onAction("request")}>Add</Button> : null}
        {person.state === "pending" && person.incoming ? <Button size="sm" className="px-3" disabled={busy} onClick={() => onAction("accept")}>Accept</Button> : null}
        {person.state === "pending" && !person.incoming ? <span className="text-xs text-ink-muted">Sent</span> : null}
        <div className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }} onKeyDown={event => { if (event.key === "Escape") { setMenuOpen(false); event.currentTarget.querySelector('button')?.focus(); } }}>
          <Button size="sm" variant="ghost" className="w-10 px-0" aria-label={`More actions for ${person.display_name}`} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>⋯</Button>
          {menuOpen ? <div className="absolute right-0 top-full z-20 min-w-40 rounded-xl border border-line bg-surface-card p-1 shadow-lg">
            {secondary.map(item => <button key={item.action} type="button" disabled={busy} className="block min-h-10 w-full rounded-lg px-3 py-2 text-left text-xs font-medium hover:bg-surface-page focus-visible:outline-2 focus-visible:outline-brand-primary disabled:opacity-45" onClick={() => { onAction(item.action); setMenuOpen(false); }}>{item.label}</button>)}
          </div> : null}
        </div>
      </div>
    </div>
  );
}
