"use client";

import Link from "next/link";
import { ArrowLeft, Award, CalendarDays, Check, GraduationCap, Search, UserPlus, Users, Zap } from "lucide-react";
import { type ReactNode, useState } from "react";
import { type PublicProfile, isApiError } from "@scholau/api";
import { useFriendAction, useFriends, useProfile, usePublicProfile, useSearchFriends } from "@scholau/api/react";
import { formatNumber } from "@scholau/core";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorState, InlineError, LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

const badgeNames: Record<string, string> = {
  first_steps: "First steps", topic_mastered: "Topic mastered", perfect_practice: "Perfect practice",
  exam_ready: "Exam ready", long_term_recall: "Long-term recall",
};

export function PeopleSearch() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const results = useSearchFriends(query);
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <header><p className="mb-2 text-sm font-semibold text-brand-primary">The ScholAu community</p><h1 className="text-3xl font-extrabold">Find people</h1><p className="mt-2 text-ink-muted">Find a classmate and get to know their learning journey.</p></header>
    <Card><CardContent className="pt-6">
      <form onSubmit={event => { event.preventDefault(); setQuery(input.trim().replace(/^@/, "")); }} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm font-semibold">Name or username<Input value={input} onChange={event => setInput(event.target.value)} placeholder="Search the community" minLength={3} maxLength={60} required type="search" /></label>
        <Button type="submit" loading={results.isFetching}><Search className="size-4" aria-hidden />Search</Button>
      </form><p className="mt-3 text-xs text-ink-muted">Enter at least 3 characters.</p>
    </CardContent></Card>
    {results.isFetching ? <LoadingState label="Finding people…" /> : results.isError ? <ErrorState error={results.error} onRetry={() => void results.refetch()} /> : query.length >= 3 && results.isSuccess ? <section aria-label="People" aria-live="polite">
      <p className="mb-3 text-sm text-ink-muted">{results.data.people.length ? `${results.data.people.length} people found` : "No people found. Try a different name or username."}</p>
      <ul className="grid gap-3 sm:grid-cols-2">{results.data.people.map(person => <li key={person.user_id}>
        <Link href={`/people/${person.user_id}`} className="flex h-full items-center gap-4 rounded-2xl border border-line bg-surface-card p-5 transition-colors hover:border-brand-primary focus-visible:outline-2 focus-visible:outline-brand-primary">
          <Avatar name={person.display_name} path={person.avatar_path} publicProfile size={56} />
          <div className="min-w-0"><h2 className="break-words font-bold">{person.display_name}</h2>{person.username ? <p className="break-all text-sm text-ink-muted">@{person.username}</p> : null}</div>
        </Link>
      </li>)}</ul>
    </section> : <div className="rounded-2xl border border-dashed border-line p-8 text-center"><Users className="mx-auto mb-3 size-8 text-brand-primary" aria-hidden /><h2 className="font-bold">Your community starts here</h2><p className="mt-2 text-sm text-ink-muted">Search for people you know, or discover fellow learners by name.</p></div>}
  </div>;
}

export function PublicProfileView({ userId }: { userId: string }) {
  const profile = usePublicProfile(userId);
  if (profile.isPending) return <LoadingState label="Loading public profile…" />;
  if (profile.isError) return <div className="mx-auto max-w-3xl"><Link href="/people" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary"><ArrowLeft className="size-4" aria-hidden />Find people</Link>{isApiError(profile.error, "NOT_FOUND") ? <Card><CardContent className="py-10 text-center"><h1 className="text-xl font-bold">Profile unavailable</h1><p className="mt-2 text-ink-muted">This profile is no longer available to view.</p></CardContent></Card> : <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />}</div>;
  return <PublicProfileContent profile={profile.data} actions={<ProfileFriendAction userId={profile.data.id} />} />;
}

function ProfileFriendAction({ userId }: { userId: string }) {
  const viewer = useProfile();
  const friends = useFriends();
  const action = useFriendAction();
  const person = friends.data?.people.find(item => item.user_id === userId);
  const ready = viewer.isSuccess && friends.isSuccess;
  if (viewer.data?.id === userId) return <Button asChild size="sm" variant="outline"><Link href="/profile">Edit profile</Link></Button>;
  return <div className="flex flex-col gap-2">
    <div className="flex flex-wrap gap-2">
      {person?.state === "accepted" ? <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-primary/25 bg-surface-tint px-4 text-sm font-semibold text-brand-primary"><Check size={16} aria-hidden />Friends</span>
        : person?.state === "blocked" ? <span className="text-sm text-ink-muted">Unavailable</span>
        : person?.state === "pending" ? <>
          {person.incoming ? <Button size="sm" loading={action.isPending} onClick={() => action.mutate({ userId, action: "accept" })}>Accept request</Button> : null}
          <Button size="sm" variant="outline" loading={action.isPending} onClick={() => action.mutate({ userId, action: person.incoming ? "decline" : "cancel" })}>{person.incoming ? "Decline" : "Cancel request"}</Button>
        </> : <Button size="sm" disabled={!ready} loading={action.isPending} onClick={() => action.mutate({ userId, action: "request" })}><UserPlus size={16} aria-hidden />Add friend</Button>}
    </div>
    <InlineError error={action.error ?? viewer.error ?? friends.error} />
    {action.isSuccess ? <p role="status" className="text-xs text-ink-muted">{action.variables?.action === "request" ? "Friend request sent" : "Friendship updated"}</p> : null}
  </div>;
}

/** Uses only the existing public-profile allowlist; no private progress is requested. */
export function PublicProfileContent({ profile: p, actions }: { profile: PublicProfile; actions?: ReactNode }) {
  const [section, setSection] = useState<"progress" | "about">("progress");
  const academic = [["University", p.university], ["Faculty", p.faculty], ["Department", p.department], ["Level", p.level]].filter(([, value]) => value);
  const joined = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(p.joined_at));
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <Link href="/people" className="inline-flex items-center gap-2 self-start text-sm font-semibold text-brand-primary"><ArrowLeft className="size-4" aria-hidden />Find people</Link>
    <section className="overflow-hidden rounded-2xl border border-brand-primary/25 bg-surface-card">
      <header className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="shrink-0 rounded-full border border-brand-primary/25 p-1"><Avatar name={p.display_name} path={p.avatar_path} size={56} publicProfile /></div>
          <div className="min-w-32 flex-1"><p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-brand-primary">ScholAu learner</p><h1 className="break-words text-xl font-bold tracking-tight sm:text-2xl">{p.display_name}</h1>{p.username ? <p className="mt-1 break-all text-sm text-ink-muted">@{p.username}</p> : null}</div>
          {actions}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1"><p className="flex items-start gap-2 text-sm text-ink-muted"><GraduationCap size={16} className="mt-0.5 shrink-0 text-brand-primary" aria-hidden /><span className="break-words">{p.department ?? "Learning on ScholAu"}{p.level ? ` · ${p.level}` : ""}</span></p>{p.university ? <p className="mt-1 break-words pl-6 text-xs text-ink-muted">{p.university}</p> : null}</div>
        </div>
      </header>
      <div role="group" aria-label="Profile sections" className="grid grid-cols-2 gap-1 border-t border-brand-primary/15 bg-surface-page/50 p-1.5">
        {(["progress", "about"] as const).map(value => <button key={value} type="button" aria-pressed={section === value} aria-controls="public-profile-section" onClick={() => setSection(value)} className={cn("min-h-10 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-primary", section === value ? "border border-brand-primary/20 bg-surface-card text-brand-primary shadow-sm" : "border border-transparent text-ink-muted hover:bg-surface-card")}>{value === "progress" ? "Progress" : "About"}</button>)}
      </div>
    </section>
    <section id="public-profile-section" aria-label={section === "progress" ? "Learning progress" : "About this learner"} className={cn("grid items-start gap-3", section === "progress" && "sm:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]")}>
      {section === "progress" ? <>
        <div className="grid grid-cols-2 gap-3 self-stretch">
          <div className="rounded-2xl border border-brand-primary/25 bg-surface-card p-4"><Zap size={18} className="mb-3 text-brand-primary" aria-hidden /><p className="text-xs text-ink-muted">Total XP</p>{p.xp_total === null ? <p className="mt-1 text-sm font-semibold">Not shared</p> : <p className="mt-1 text-2xl font-bold tabular-nums text-brand-primary">{formatNumber(p.xp_total)}</p>}</div>
          <div className="rounded-2xl border border-brand-primary/25 bg-surface-card p-4"><Award size={18} className="mb-3 text-brand-primary" aria-hidden /><p className="text-xs text-ink-muted">Badges earned</p><p className="mt-1 text-2xl font-bold tabular-nums text-brand-primary">{p.badges.length}</p></div>
        </div>
        <Card className="border-brand-primary/25 shadow-none"><CardHeader><CardTitle>Learning milestones</CardTitle></CardHeader><CardContent>
          {p.badges.length ? <ul className="flex flex-wrap gap-2">{p.badges.map(code => <li key={code} className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-brand-primary/15 bg-surface-tint/40 p-2.5"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-tint"><Award className="size-4 text-brand-primary" aria-hidden /></span><span className="min-w-0 break-words text-xs font-semibold">{badgeNames[code] ?? "Learning milestone"}</span></li>)}</ul> : <div className="py-4 text-center"><Award className="mx-auto mb-2 size-7 text-brand-primary" aria-hidden /><p className="text-sm font-semibold">Every journey starts somewhere</p><p className="mt-1 text-xs text-ink-muted">Earned badges will appear here.</p></div>}
        </CardContent></Card>
      </> : <Card className="border-brand-primary/25 shadow-none"><CardHeader><CardTitle>Academic profile</CardTitle></CardHeader><CardContent>
        {academic.length ? <dl className="grid gap-4 sm:grid-cols-2">{academic.map(([label, value]) => <div key={label}><dt className="text-xs text-ink-muted">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value}</dd></div>)}</dl> : <p className="text-sm text-ink-muted">No academic information shared yet.</p>}
        <p className="mt-5 flex items-center gap-2 border-t border-line pt-3 text-xs text-ink-muted"><CalendarDays size={14} aria-hidden />Joined {joined}</p>
      </CardContent></Card>}
    </section>
    <p className="text-center text-xs text-ink-muted">You’re viewing the information this learner shares with the ScholAu community.</p>
  </div>;
}
