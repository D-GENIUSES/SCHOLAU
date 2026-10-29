"use client";

import { Avatar } from "@/components/ui/avatar";
import { LegalLinks } from "@/components/legal-links";
import { useState, type ReactNode } from "react";
import { Segmented } from "@/components/ui/segmented";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useFriends, useProfile, useXpProgress } from "@scholau/api/react";
import type { Profile, XpProgress } from "@scholau/api";
import { formatDate, formatNumber, formatStreak, formatXpDelta, NIGERIAN_UNIVERSITIES, SEMESTER_LABELS, type RegistrationAcademicInput } from "@scholau/core";
import { XpProgressCard } from "@/components/xp/xp-progress";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ReportDialog } from "@/components/report-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { AppBookIcon, AppStarIcon, AppSwordsIcon } from "@/components/icons/app-chrome-icons";
import { StreakFlame } from "@/components/icons/streak-flame";
import { AccountDeletionDialog } from "./account-deletion-dialog";
import { AcademicDetailsCard } from "./academic-details-card";
import { ProfileEditForm } from "./profile-edit-form";
import { ProfileFriends } from "./profile-friends";

const activityNames: Record<string, string> = { lesson: "Lesson progress", review: "Topic review", practice: "Practice test", mock: "Mock exam", battle: "Quiz battle", signup: "Account created", correction: "XP adjustment" };

const SETTINGS_SECTIONS = [
  { id: "account", label: "Account" },
  { id: "academic", label: "Academic" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
  { id: "support", label: "Support" },
] as const;

type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];

function LearningActivity({ data }: { data: XpProgress }) {
  const today = new Date(data.server_time);
  const localKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getTime() - (6 - index) * 86_400_000);
    const key = localKey(date);
    const xp = data.history.reduce((sum, award) => localKey(new Date(award.date)) === key ? sum + Math.max(0, award.amount) : sum, 0);
    return { key, date, xp };
  });
  const max = Math.max(1, ...days.map((day) => day.xp));
  return (
    <Card className="profile-activity-chart">
      <CardHeader>
        <p className="profile-activity-label">Weekly XP</p>
        <CardTitle>Learning activity</CardTitle>
        <p className="text-sm text-ink-muted">Last 7 days · XP earned</p>
      </CardHeader>
      <CardContent>
        <div className="mt-5 flex h-36 items-end gap-3" role="img" aria-label={days.map((day) => `${formatDate(day.date.toISOString())}: ${day.xp} XP`).join("; ")}>
          {days.map((day) => (
            <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2" aria-hidden>
              <div className="flex w-full flex-1 items-end rounded-t-lg bg-surface-page">
                <div className="w-full rounded-t-lg bg-gradient-to-t from-brand-primary to-brand-bright" style={{ height: `${day.xp ? Math.max(8, day.xp / max * 100) : 0}%` }} />
              </div>
              <span className="text-xs text-ink-muted">{new Intl.DateTimeFormat("en", { weekday: "narrow", timeZone: "Africa/Lagos" }).format(day.date)}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-muted">Based on your latest 50 XP awards. Days use West Africa Time.</p>
        <p className="mt-4 text-sm text-ink-muted">{days.some((day) => day.xp > 0) ? "XP earned this week." : "No XP recorded in the last 7 days."}</p>
      </CardContent>
    </Card>
  );
}

function ActivityCards() {
  const query = useXpProgress();
  if (query.isPending) return <LoadingState variant="activity" label="Loading learning activity…" lines={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <>
      <div className="min-w-0">
        <LearningActivity data={query.data} />
      </div>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <p className="text-sm text-ink-muted">Your latest XP awards</p>
        </CardHeader>
        <CardContent>
          {query.data.history.length ? (
            <ul className="divide-y divide-line">
              {query.data.history.slice(0, 4).map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-4 first:pt-2 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{activityNames[item.activity] ?? "Learning activity"}</p>
                    <p className="mt-0.5 break-words text-xs text-ink-muted">{item.reason}</p>
                    <p className="mt-1 text-xs text-ink-muted">{formatDate(item.date)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-brand-primary">{formatXpDelta(item.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-5">
              <p className="font-semibold">No activity yet</p>
              <p className="mt-1 text-sm text-ink-muted">Complete a knowledge check to start a history.</p>
              <Button asChild variant="link" className="mt-3">
                <Link href="/home">
                  Go to Home <ChevronRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function ProfileNudge({ profile }: { profile: Profile }) {
  const { streak, learning_totals } = profile;
  let label: string;
  let title: string;
  if (!streak.active_today && streak.current > 0) {
    label = "Streak";
    title = `Keep your ${formatStreak(streak.current)} streak going today`;
  } else if (learning_totals.lessons_completed === 0) {
    label = "Get started";
    title = "Start your first lesson on Home";
  } else {
    label = "Continue";
    title = "Pick up your course map on Home";
  }
  return (
    <section className="profile-nudge-banner" aria-label="Suggested next step">
      <div className="profile-nudge-copy">
        <p className="profile-nudge-label">{label}</p>
        <p className="profile-nudge-title">{title}</p>
      </div>
      <Button asChild size="sm">
        <Link href="/home">Go to Home</Link>
      </Button>
    </section>
  );
}

function StatTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: "streak" | "purple";
  icon: ReactNode;
}) {
  return (
    <Card className="profile-stat">
      <div className="profile-stat-icon" data-tone={tone}>
        {icon}
      </div>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
      </div>
    </Card>
  );
}

export function ProfileView({ registration = null, email = null }: { registration?: RegistrationAcademicInput | null; email?: string | null }) {
  const [tab, setTab] = useState<"progress" | "activity" | "achievements" | "friends" | "settings">("progress");
  const [section, setSection] = useState<SettingsSection>("account");
  const profile = useProfile();
  const friends = useFriends();
  const requestCount = friends.data?.people.filter((person) => person.state === "pending" && person.incoming).length ?? 0;
  if (profile.isPending) return <LoadingState variant="profile" label="Loading your profile…" lines={4} />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
  const p = profile.data;
  const username = "username" in p && typeof p.username === "string" ? p.username : null;
  const university = p.academic?.university.name ?? NIGERIAN_UNIVERSITIES.find((item) => item.value === registration?.universitySlug)?.label;
  const department = p.academic?.department.name ?? registration?.department;
  const academicEyebrow = p.academic
    ? [p.academic.department.name, p.academic.level.label, p.academic.semester.label].filter(Boolean).join(" · ")
    : null;
  const rows = [
    [username ? "Username" : "Display name", username ?? p.display_name],
    ["Email", email ?? "Not available"],
    ["University", university ?? "Not added yet"],
    ["Department", department ?? "Not added yet"],
    ["Level", p.academic?.level.label ?? "Not added yet"],
    ["Semester", p.academic?.semester.label ?? (registration ? SEMESTER_LABELS[registration.currentSemester] : "Not added yet")],
  ];

  return (
    <div className="compact-profile">
      <Dialog>
        <header className="profile-identity-panel">
          <div className="profile-identity-main">
            {academicEyebrow ? <p className="profile-identity-eyebrow">{academicEyebrow}</p> : null}
            <div className="profile-identity">
              <Link href={`/people/${p.id}`} className="rounded-full focus-visible:outline-2 focus-visible:outline-brand-primary" aria-label="View your public profile">
                <Avatar name={p.display_name} path={p.avatar_path} size={72} variant="profile" />
              </Link>
              <div className="min-w-0 flex-1">
                <h1>
                  <Link href={`/people/${p.id}`} className="hover:underline">
                    {p.display_name}
                  </Link>
                </h1>
                {username ? <p>@{username}</p> : department ? <p>{department}</p> : null}
                {university ? <p className="profile-university">{university}</p> : null}
              </div>
            </div>
            <div className="profile-identity-actions">
              <Button asChild variant="outline" size="sm">
                <Link href={`/people/${p.id}`}>View public profile</Link>
              </Button>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Edit profile
                </Button>
              </DialogTrigger>
            </div>
          </div>
        </header>
        <Segmented
          name="profile-view"
          legend="Profile section"
          value={tab}
          onChange={setTab}
          options={[
            { value: "progress", label: "Progress" },
            { value: "activity", label: "Activity" },
            { value: "achievements", label: "Badges" },
            { value: "friends", label: requestCount ? `Friends (${requestCount})` : "Friends" },
            { value: "settings", label: "Settings" },
          ]}
        />
        <section
          className="profile-panel"
          aria-label={
            tab === "settings" ? "Settings" : tab === "friends" ? "Friends" : tab === "activity" ? "Activity" : tab === "achievements" ? "Badges and reviews" : "Progress"
          }
        >
          {tab === "progress" ? (
            <>
              <section aria-label="Learning statistics" className="profile-stat-grid">
                <StatTile label="Total XP" value={formatNumber(p.xp_total)} icon={<AppStarIcon className="size-5" />} />
                <StatTile
                  label="Current streak"
                  value={formatStreak(p.streak.current)}
                  tone="streak"
                  icon={<StreakFlame active={p.streak.active_today} size={22} />}
                />
                <StatTile label="Lessons completed" value={formatNumber(p.learning_totals.lessons_completed)} icon={<AppBookIcon className="size-5" />} />
                <StatTile label="Battles completed" value={formatNumber(p.learning_totals.battles_completed)} tone="purple" icon={<AppSwordsIcon className="size-5" />} />
              </section>
              <ProfileNudge profile={p} />
              <XpProgressCard compact />
            </>
          ) : tab === "achievements" ? (
            <XpProgressCard />
          ) : tab === "activity" ? (
            <div className="profile-activity-grid">
              <ActivityCards />
            </div>
          ) : tab === "friends" ? (
            <ProfileFriends />
          ) : (
            <Card className="settings-card">
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <nav className="settings-nav" aria-label="Settings sections">
                  {SETTINGS_SECTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="settings-nav-item"
                      data-active={section === item.id || undefined}
                      aria-current={section === item.id ? "true" : undefined}
                      onClick={() => setSection(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
                {section === "account" || section === "academic" ? (
                  <section className="settings-body">
                    <div className="section-heading">
                      <h2>{section === "account" ? "Account information" : "Academic details"}</h2>
                      {section === "account" ? (
                        <DialogTrigger asChild>
                          <Button variant="link" size="sm">
                            Edit
                          </Button>
                        </DialogTrigger>
                      ) : null}
                    </div>
                    <dl className="settings-details">
                      {(section === "account" ? rows.slice(0, 2) : rows.slice(2)).map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    {section === "academic" ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            Manage academic details
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogTitle>Academic details</DialogTitle>
                          <DialogDescription>Your academic profile determines the courses available to you.</DialogDescription>
                          <AcademicDetailsCard academic={p.academic} registration={registration} />
                        </DialogContent>
                      </Dialog>
                    ) : null}
                    {section === "account" ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <SignOutButton variant="outline" size="md" />
                        <AccountDeletionDialog />
                      </div>
                    ) : null}
                  </section>
                ) : section === "security" ? (
                  <section className="settings-body">
                    <h2>Security</h2>
                    <Link href="/change-password" className="settings-link">
                      Change password <ChevronRight size={18} aria-hidden />
                    </Link>
                    <div className="mt-6 border-t border-line pt-4">
                      <AccountDeletionDialog />
                    </div>
                  </section>
                ) : section === "notifications" ? (
                  <div className="settings-body">
                    <NotificationSettings owner={p.id} />
                  </div>
                ) : (
                  <section className="settings-body">
                    <h2>Support & privacy</h2>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <ReportDialog targetType="technical" triggerLabel="Contact support" title="Contact support" />
                      <Button asChild variant="outline">
                        <Link href="/privacy">Privacy Policy</Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/terms">Terms of Use</Link>
                      </Button>
                      {p.roles.includes("admin") ? (
                        <Button asChild variant="outline">
                          <Link href="/admin">Admin</Link>
                        </Button>
                      ) : null}
                    </div>
                  </section>
                )}
                <footer className="mt-6 border-t border-line pt-4">
                  <LegalLinks />
                </footer>
              </CardContent>
            </Card>
          )}
        </section>
        <DialogContent>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update how you appear to other learners.</DialogDescription>
          <ProfileEditForm key={p.id} profile={p} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
