"use client";

import Link from "next/link";
import { ArrowLeft, Award, GraduationCap, Search, Users } from "lucide-react";
import { useState } from "react";
import { isApiError } from "@scholau/api";
import { usePublicProfile, useSearchFriends } from "@scholau/api/react";
import { formatNumber } from "@scholau/core";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorState, LoadingState } from "@/components/ui/states";

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
  const p = profile.data;
  const academic = [["University", p.university], ["Faculty", p.faculty], ["Department", p.department], ["Level", p.level]].filter(([, value]) => value);
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <Link href="/people" className="inline-flex items-center gap-2 self-start text-sm font-semibold text-brand-primary"><ArrowLeft className="size-4" aria-hidden />Find people</Link>
    <section className="overflow-hidden rounded-3xl border border-line bg-surface-card">
      <div aria-hidden className="h-24 bg-surface-card sm:h-32" />
      <header className="px-5 pb-6 sm:px-8">
        <div className="-mt-12 inline-flex rounded-full border-4 border-surface-card bg-surface-card"><Avatar name={p.display_name} path={p.avatar_path} size={96} publicProfile /></div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-brand-primary">Public profile</p>
        <h1 className="mt-2 break-words text-3xl font-extrabold">{p.display_name}</h1>
        {p.username ? <p className="mt-1 break-all text-ink-muted">@{p.username}</p> : null}
        <p className="mt-3 text-sm text-ink-muted">{p.department ?? "ScholAu learner"}{p.university ? ` · ${p.university}` : ""}</p>
        <p className="mt-2 text-xs text-ink-muted">Joined {new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(p.joined_at))}</p>
      </header>
    </section>
    <div className="grid gap-6 sm:grid-cols-2">
      <Card><CardHeader><CardTitle><span className="flex items-center gap-2"><GraduationCap className="size-5 text-brand-primary" aria-hidden />Academic profile</span></CardTitle></CardHeader><CardContent>{academic.length ? <dl className="space-y-4">{academic.map(([label, value]) => <div key={label}><dt className="text-xs text-ink-muted">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl> : <p className="text-sm text-ink-muted">No academic information shared yet.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle><span className="flex items-center gap-2"><Award className="size-5 text-brand-primary" aria-hidden />Learning achievements</span></CardTitle></CardHeader><CardContent>
        {p.xp_total !== null ? <div className="mb-5 rounded-2xl bg-surface-tint p-4"><p className="text-xs font-semibold text-brand-primary">Total XP</p><p className="mt-1 text-3xl font-extrabold text-brand-primary">{formatNumber(p.xp_total)}</p></div> : null}
        {p.badges.length ? <ul className="space-y-3">{p.badges.map(code => <li key={code} className="flex items-center gap-3 rounded-xl border border-line p-3"><Award className="size-5 shrink-0 text-brand-primary" aria-hidden /><span className="text-sm font-semibold">{badgeNames[code] ?? "Learning milestone"}</span></li>)}</ul> : <p className="text-sm text-ink-muted">No badges earned yet. Every learning journey starts somewhere.</p>}
      </CardContent></Card>
    </div>
    <p className="text-center text-xs text-ink-muted">You’re viewing the information this learner shares with the ScholAu community.</p>
  </div>;
}
