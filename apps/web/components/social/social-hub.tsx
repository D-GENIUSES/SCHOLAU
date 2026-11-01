"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import type { FriendAction, FriendPerson } from "@scholau/api";
import { useFriendAction, useFriends, useSearchFriends } from "@scholau/api/react";
import { OnlineAvatar } from "@/components/ui/online-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";

export function SocialHub() {
  const friends = useFriends();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title="Social" description="Find classmates and manage your friends." />
      {friends.isPending ? <LoadingState label="Loading friends…" /> : null}
      {friends.isError ? <ErrorState error={friends.error} onRetry={() => void friends.refetch()} /> : null}
      {friends.isSuccess ? <SocialContent username={friends.data.username} people={friends.data.people} /> : null}
    </div>
  );
}

function SocialContent({ username, people }: { username: string; people: FriendPerson[] }) {
  const action = useFriendAction();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const results = useSearchFriends(query);
  const requests = people.filter((person) => person.state === "pending" && person.incoming);
  const accepted = people.filter((person) => person.state === "accepted").sort((a, b) => a.display_name.localeCompare(b.display_name));
  const sent = people.filter((person) => person.state === "pending" && !person.incoming);
  const blocked = people.filter((person) => person.state === "blocked");
  const busy = action.isPending;
  const act = (person: FriendPerson, value: FriendAction) => action.mutate({ userId: person.user_id, action: value });

  return (
    <>
      {username ? <p className="text-sm text-ink-muted">Your username is @{username}</p> : null}
      <Card>
        <CardContent className="pt-6">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(search.trim().replace(/^@/, ""));
            }}
          >
            <label className="min-w-0 flex-1 text-sm font-semibold">
              Name or username
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or username" minLength={3} maxLength={60} required type="search" />
            </label>
            <Button type="submit" loading={results.isFetching}>
              <Search className="size-4" aria-hidden />
              Search
            </Button>
          </form>
          <p className="mt-3 text-xs text-ink-muted">Enter at least 3 characters.</p>
        </CardContent>
      </Card>
      <InlineError error={results.error} />
      {query.length >= 3 && results.isFetching ? <p role="status" className="text-sm text-ink-muted">Finding people…</p> : null}
      {query.length >= 3 && results.isSuccess ? (
        <section aria-label="Search results" aria-live="polite" className="flex flex-col">
          <h2 className="text-sm font-semibold">{results.data.people.length ? "Search results" : "No people found"}</h2>
          {results.data.people.length ? (
            <ul className="mt-1 divide-y divide-line">
              {results.data.people.map((person) => (
                <li key={person.user_id}>
                  <PersonRow person={person} busy={busy} onAction={(value) => act(person, value)} primary={<SearchState person={person} busy={busy} onAction={(value) => act(person, value)} />} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">Try a different name or username.</p>
          )}
        </section>
      ) : null}
      {requests.length ? (
        <section aria-label="Friend requests">
          <h2 className="pb-1 text-sm font-semibold">Friend requests <Count value={requests.length} /></h2>
          <ul className="divide-y divide-line">
            {requests.map((person) => (
              <li key={person.user_id}>
                <PersonRow
                  person={person}
                  busy={busy}
                  hidePendingMenu
                  onAction={(value) => act(person, value)}
                  primary={
                    <>
                      <Button size="sm" disabled={busy} onClick={() => act(person, "accept")}>Accept</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => act(person, "decline")}>Decline</Button>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-label="Friends">
        <h2 className="pb-1 text-sm font-semibold">Friends{accepted.length ? <> <Count value={accepted.length} /></> : null}</h2>
        {accepted.length ? (
          <ul className="divide-y divide-line">
            {accepted.map((person) => (
              <li key={person.user_id}>
                <PersonRow
                  person={person}
                  busy={busy}
                  onAction={(value) => act(person, value)}
                  primary={
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/battles?friend=${person.user_id}`}>Challenge</Link>
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No friends yet" description="Search for a classmate by name or username." />
        )}
      </section>
      <CollapsedPeople label="Sent requests" people={sent} busy={busy} onAction={act} />
      <CollapsedPeople label="Blocked" people={blocked} busy={busy} onAction={act} />
      <InlineError error={action.error} />
    </>
  );
}

function CollapsedPeople({
  label,
  people,
  busy,
  onAction,
}: {
  label: string;
  people: FriendPerson[];
  busy: boolean;
  onAction: (person: FriendPerson, value: FriendAction) => void;
}) {
  if (!people.length) return null;
  return (
    <details className="rounded-card border border-line bg-surface-card">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary [&::-webkit-details-marker]:hidden">
        {label} <Count value={people.length} />
      </summary>
      <ul className="divide-y divide-line border-t border-line px-4">
        {people.map((person) => (
          <li key={person.user_id}>
            <PersonRow person={person} busy={busy} onAction={(value) => onAction(person, value)} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function SearchState({ person, busy, onAction }: { person: FriendPerson; busy: boolean; onAction: (value: FriendAction) => void }) {
  if (!person.state) return <Button size="sm" disabled={busy} onClick={() => onAction("request")}>Add</Button>;
  if (person.state === "pending" && person.incoming) return <Button size="sm" disabled={busy} onClick={() => onAction("accept")}>Accept</Button>;
  if (person.state === "pending") return <span className="text-xs text-ink-muted">Sent</span>;
  if (person.state === "accepted") return <span className="text-xs font-semibold text-brand-primary">Friends</span>;
  return <span className="text-xs text-ink-muted">Blocked</span>;
}

function PersonRow({
  person,
  busy,
  onAction,
  primary,
  hidePendingMenu = false,
}: {
  person: FriendPerson;
  busy: boolean;
  onAction: (value: FriendAction) => void;
  primary?: ReactNode;
  hidePendingMenu?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const secondary: { label: string; action: FriendAction }[] = [
    ...(!hidePendingMenu && person.state === "pending" ? [{ label: person.incoming ? "Decline request" : "Cancel request", action: (person.incoming ? "decline" : "cancel") as FriendAction }] : []),
    ...(person.state === "accepted" ? [{ label: "Remove friend", action: "remove" as FriendAction }] : []),
    { label: person.state === "blocked" ? "Unblock" : "Block", action: person.state === "blocked" ? "unblock" : "block" },
  ];

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3 py-3">
      <Link href={`/people/${person.user_id}`} className="flex min-w-0 flex-1 basis-40 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-brand-primary">
        <OnlineAvatar name={person.display_name} path={person.avatar_path} size={40} online={person.online} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{person.display_name}</span>
          {person.username ? <span className="block truncate text-xs text-ink-muted">@{person.username}</span> : null}
        </span>
      </Link>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {primary}
        <div
          className="relative"
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setMenuOpen(false);
              event.currentTarget.querySelector("button")?.focus();
            }
          }}
        >
          <Button size="sm" variant="ghost" className="w-10 px-0" aria-label={`More actions for ${person.display_name}`} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>⋯</Button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-20 min-w-40 rounded-xl border border-line bg-surface-card p-1 shadow-lg">
              {secondary.map((item) => (
                <button key={item.action} type="button" disabled={busy} className="block min-h-10 w-full rounded-lg px-3 py-2 text-left text-xs font-medium hover:bg-surface-page focus-visible:outline-2 focus-visible:outline-brand-primary disabled:opacity-45" onClick={() => { onAction(item.action); setMenuOpen(false); }}>
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Count({ value }: { value: number }) {
  return <span className="rounded-full bg-surface-page px-1.5 text-xs font-semibold tabular-nums text-ink-muted">{value}</span>;
}
