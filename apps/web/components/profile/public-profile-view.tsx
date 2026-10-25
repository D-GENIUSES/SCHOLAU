"use client";

import Link from "next/link";
import { ArrowLeft, Award, Check, Search, UserPlus } from "lucide-react";
import { AppStarIcon } from "@/components/icons/app-chrome-icons";
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

export function PeopleSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery.trim().replace(/^@/, ""));
  const results = useSearchFriends(query);
  return <div className="public-profile-page">
    <header className="public-profile-page-head"><h1>Find people</h1><p>Search by name or username.</p></header>
    <Card className="public-profile-search-card"><CardContent className="pt-6">
      <form onSubmit={event => { event.preventDefault(); setQuery(input.trim().replace(/^@/, "")); }} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm font-semibold">Name or username<Input value={input} onChange={event => setInput(event.target.value)} placeholder="Name or username" minLength={3} maxLength={60} required type="search" /></label>
        <Button type="submit" loading={results.isFetching}><Search className="size-4" aria-hidden />Search</Button>
      </form><p className="mt-3 text-xs text-ink-muted">Enter at least 3 characters.</p>
    </CardContent></Card>
    {results.isFetching ? <LoadingState label="Finding people…" /> : results.isError ? <ErrorState error={results.error} onRetry={() => void results.refetch()} /> : query.length >= 3 && results.isSuccess ? <section aria-label="People" aria-live="polite">
      <p className="mb-3 text-sm text-ink-muted">{results.data.people.length ? `${results.data.people.length} people found` : "No people found. Try a different name or username."}</p>
      <ul className="grid gap-3 sm:grid-cols-2">{results.data.people.map(person => <li key={person.user_id}>
        <Link href={`/people/${person.user_id}`} className="public-profile-person-link">
          <Avatar name={person.display_name} path={person.avatar_path} publicProfile size={56} />
          <div className="min-w-0"><h2 className="break-words font-bold">{person.display_name}</h2>{person.username ? <p className="break-all text-sm text-ink-muted">@{person.username}</p> : null}</div>
        </Link>
      </li>)}</ul>
    </section> : <div className="public-profile-empty"><h2>Search for someone</h2><p>Enter a name or username to find classmates.</p></div>}
  </div>;
}

export function PublicProfileView({ userId }: { userId: string }) {
  const profile = usePublicProfile(userId);
  if (profile.isPending) return <LoadingState label="Loading public profile…" />;
  if (profile.isError) return <div className="public-profile-page"><Link href="/people" className="public-profile-back"><ArrowLeft className="size-4" aria-hidden />Find people</Link>{isApiError(profile.error, "NOT_FOUND") ? <Card className="public-profile-unavailable"><CardContent className="py-10 text-center"><h1 className="text-xl font-bold">Profile unavailable</h1><p className="mt-2 text-ink-muted">This profile is no longer available to view.</p></CardContent></Card> : <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />}</div>;
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
  const eyebrow = [p.department, p.level].filter(Boolean).join(" · ");
  return (
    <div className="public-profile-page">
      <Link href="/people" className="public-profile-back">
        <ArrowLeft className="size-4" aria-hidden />
        Find people
      </Link>
      <section className="public-profile-hero">
        {eyebrow ? <p className="profile-identity-eyebrow">{eyebrow}</p> : null}
        <div className="public-profile-hero-row">
          <Avatar name={p.display_name} path={p.avatar_path} size={56} publicProfile variant="profile" />
          <div className="public-profile-hero-copy">
            <h1>{p.display_name}</h1>
            {p.username ? <p className="public-profile-username">@{p.username}</p> : null}
          </div>
        </div>
        {p.university ? <p className="public-profile-university">{p.university}</p> : null}
        {actions ? <div className="public-profile-actions">{actions}</div> : null}
        <div role="group" aria-label="Profile sections" className="public-profile-tabs">
          {(["progress", "about"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={section === value}
              aria-controls="public-profile-section"
              onClick={() => setSection(value)}
              className={cn("public-profile-tab", section === value && "is-active")}
            >
              {value === "progress" ? "Progress" : "About"}
            </button>
          ))}
        </div>
      </section>
      <section
        id="public-profile-section"
        aria-label={section === "progress" ? "Learning progress" : "About this learner"}
        className={cn("public-profile-body", section === "progress" && "public-profile-body-progress")}
      >
        {section === "progress" ? (
          <>
            <div className="public-profile-stat-grid">
              <div className="public-profile-stat">
                <div className="profile-stat-icon">
                  <AppStarIcon className="size-5" />
                </div>
                <div>
                  {p.xp_total === null ? (
                    <>
                      <strong>—</strong>
                      <p>Total XP not shared</p>
                    </>
                  ) : (
                    <>
                      <strong>{formatNumber(p.xp_total)}</strong>
                      <p>Total XP</p>
                    </>
                  )}
                </div>
              </div>
              <div className="public-profile-stat">
                <div className="profile-stat-icon" data-tone="purple">
                  <Award className="size-5" aria-hidden />
                </div>
                <div>
                  <strong>{p.badges.length}</strong>
                  <p>Badges</p>
                </div>
              </div>
            </div>
            <Card className="public-profile-milestones">
              <CardHeader>
                <p className="profile-activity-label">Achievements</p>
                <CardTitle>Learning milestones</CardTitle>
              </CardHeader>
              <CardContent>
                {p.badges.length ? (
                  <ul className="public-profile-badge-list">
                    {p.badges.map((code) => (
                      <li key={code}>
                        <span className="profile-badge-count">{badgeNames[code] ?? "Badge"}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="py-4">
                    <p className="text-sm font-semibold">No badges yet</p>
                    <p className="mt-1 text-xs text-ink-muted">Badges appear here when they are earned.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="public-profile-about">
            <CardHeader>
              <p className="profile-activity-label">Academic</p>
              <CardTitle>Academic profile</CardTitle>
            </CardHeader>
            <CardContent>
              {academic.length ? (
                <dl className="public-profile-about-grid">
                  {academic.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-ink-muted">No academic information shared yet.</p>
              )}
              <p className="public-profile-joined">Joined {joined}</p>
            </CardContent>
          </Card>
        )}
      </section>
      <p className="public-profile-disclaimer">Only information this person has chosen to share is shown.</p>
    </div>
  );
}
