"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useProfile, useXpProgress } from "@scholau/api/react";
import type { XpProgress } from "@scholau/api";
import { formatDate, formatNumber, formatStreak, formatXpDelta, initials, NIGERIAN_UNIVERSITIES, SEMESTER_LABELS, type RegistrationAcademicInput } from "@scholau/core";
import { XpProgressCard } from "@/components/xp/xp-progress";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ReportDialog } from "@/components/report-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/misc";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { AccountDeletionDialog } from "./account-deletion-dialog";
import { AcademicDetailsCard } from "./academic-details-card";
import { ProfileEditForm } from "./profile-edit-form";

const activityNames: Record<string, string> = { lesson: "Lesson progress", review: "Topic review", practice: "Practice test", mock: "Mock exam", battle: "Quiz battle", signup: "Welcome to ScholAu", correction: "XP adjustment" };

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
  return <Card>
    <CardHeader><CardTitle>Learning activity</CardTitle><p className="text-sm text-ink-muted">Last 7 days Â· XP earned</p></CardHeader>
    <CardContent>
      <div className="mt-5 flex h-36 items-end gap-3" role="img" aria-label={days.map((day) => `${formatDate(day.date.toISOString())}: ${day.xp} XP`).join("; ")}>
        {days.map((day) => <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2" aria-hidden>
          <div className="flex w-full flex-1 items-end rounded-t-lg bg-surface-page"><div className="w-full rounded-t-lg bg-gradient-to-t from-brand-primary to-brand-bright" style={{ height: `${day.xp ? Math.max(8, day.xp / max * 100) : 0}%` }} /></div>
          <span className="text-xs text-ink-muted">{new Intl.DateTimeFormat("en", { weekday: "narrow", timeZone: "Africa/Lagos" }).format(day.date)}</span>
        </div>)}
      </div>
      <p className="mt-4 text-xs text-ink-muted">Based on your latest 50 XP awards. Days use West Africa Time.</p>
      <p className="mt-4 flex items-start gap-2 text-sm text-ink-muted">{days.some((day) => day.xp > 0) ? "Keep showing up. Every lesson counts." : "Your next learning session starts the story."}</p>
    </CardContent>
  </Card>;
}

function ActivityCards() {
  const query = useXpProgress();
  if (query.isPending) return <LoadingState label="Loading learning activityâ€¦" lines={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <>
    <div className="lg:col-start-2 lg:row-start-1"><LearningActivity data={query.data} /></div>
    <Card className="lg:col-start-1 lg:row-start-2">
      <CardHeader><CardTitle>Recent activity</CardTitle><p className="text-sm text-ink-muted">Your latest XP awards</p></CardHeader>
      <CardContent>
        {query.data.history.length ? <ul className="divide-y divide-line">{query.data.history.slice(0, 4).map((item) => {
          return <li key={item.id} className="flex items-start gap-3 py-4 first:pt-2 last:pb-0">
            
            <div className="min-w-0 flex-1"><p className="font-semibold">{activityNames[item.activity] ?? "Learning activity"}</p><p className="mt-0.5 break-words text-xs text-ink-muted">{item.reason}</p><p className="mt-1 text-xs text-ink-muted">{formatDate(item.date)}</p></div>
            <span className="shrink-0 text-sm font-semibold text-brand-primary">{formatXpDelta(item.amount)}</span>
          </li>;
        })}</ul> : <div className="py-5"><p className="font-semibold">Your journey starts here.</p><p className="mt-1 text-sm text-ink-muted">Complete a knowledge check to start building your learning history.</p><Button asChild variant="link" className="mt-3"><Link href="/study">Explore learning <ChevronRight className="size-4" aria-hidden /></Link></Button></div>}
      </CardContent>
    </Card>
  </>;
}

export function ProfileView({ registration = null, email = null }: { registration?: RegistrationAcademicInput | null; email?: string | null }) {
  const profile = useProfile();
  if (profile.isPending) return <LoadingState label="Loading your profileâ€¦" lines={4} />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
  const p = profile.data;
  const university = p.academic?.university.name ?? NIGERIAN_UNIVERSITIES.find((item) => item.value === registration?.universitySlug)?.label;
  const department = p.academic?.department.name ?? registration?.department;
  const rows = [
    ["Display name", p.display_name], ["Email", email ?? "Not available"],
    ["University", university ?? "Not added yet"], ["Department", department ?? "Not added yet"],
    ["Level", p.academic?.level.label ?? "Not added yet"],
    ["Semester", p.academic?.semester.label ?? (registration ? SEMESTER_LABELS[registration.currentSemester] : "Not added yet")],
  ];
  const stats = [
    { label: "Total XP", value: formatNumber(p.xp_total) },
    { label: "Current streak", value: formatStreak(p.streak.current) },
    { label: "Lessons completed", value: formatNumber(p.learning_totals.lessons_completed) },
    { label: "Battles completed", value: formatNumber(p.learning_totals.battles_completed) },
  ];
  return <>
    <PageHeader eyebrow={<span className="text-[10px] uppercase tracking-[0.16em]">Your profile</span>} title="Your profile" description="Your learning journey, all in one place." />
    <Dialog>
      <Card tint className="mb-4 flex flex-col gap-5 bg-gradient-to-br from-surface-tint to-[#deedff] p-5 sm:flex-row sm:items-center sm:p-7">
        <span className="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-brand-primary text-2xl font-bold text-white shadow-card" aria-hidden>{initials(p.display_name)}</span>
        <div className="min-w-0 flex-1"><h2 className="break-words text-2xl font-bold">{p.display_name}</h2><p className="mt-1 text-ink-muted">{department ? `${department} student` : "ScholAu learner"}</p><p className="mt-2 text-sm text-ink-muted">{university ? `${university} Â· ` : ""}Joined {new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(p.created_at))}</p></div>
        <DialogTrigger asChild><Button className="rounded-pill">Edit profile</Button></DialogTrigger>
      </Card>
      <section aria-label="Learning statistics" className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map(({ label, value }) => <Card key={label} className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5"><div className="min-w-0"><p className="break-words text-xl font-bold">{value}</p><p className="text-xs text-ink-muted sm:text-sm">{label}</p></div></Card>)}
      </section>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="lg:col-start-1 lg:row-start-1">
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Personal information</CardTitle><DialogTrigger asChild><Button variant="link" size="sm" aria-label="Edit personal information">Edit</Button></DialogTrigger></CardHeader>
          <CardContent><dl className="divide-y divide-line">{rows.map(([label, value]) => <div key={label} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] sm:gap-5"><dt className="text-ink-muted">{label}</dt><dd className="min-w-0 break-words font-medium">{value}</dd></div>)}</dl>
            <Dialog><DialogTrigger asChild><Button variant="link" size="sm" className="mt-3">Manage academic details <ChevronRight className="size-4" aria-hidden /></Button></DialogTrigger><DialogContent><DialogTitle>Academic details</DialogTitle><DialogDescription>Your academic profile determines the courses available to you.</DialogDescription><AcademicDetailsCard academic={p.academic} registration={registration} /></DialogContent></Dialog>
          </CardContent>
        </Card>
        <ActivityCards />
        <Card className="lg:col-start-2 lg:row-start-2"><CardHeader><CardTitle>Account</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">
          <Link href="/change-password" className="flex items-center gap-3 rounded-xl border border-line p-4 hover:bg-surface-tint"><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Password</span><span className="block text-xs text-ink-muted">Change your account password</span></span><ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden /></Link>
          <SignOutButton variant="outline" size="md" className="justify-start rounded-xl" />
          <div className="mt-1 border-t border-line pt-3"><AccountDeletionDialog /></div>
        </CardContent></Card>
      </div>
      <DialogContent><DialogTitle>Edit profile</DialogTitle><DialogDescription>Update how you appear to other learners.</DialogDescription><ProfileEditForm key={p.id} profile={p} /></DialogContent>
    </Dialog>
    <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <details className="rounded-card border border-line bg-surface-card p-5"><summary className="cursor-pointer font-semibold text-brand-primary">Learning progress, badges and reviews</summary><div className="mt-4"><XpProgressCard /></div></details>
      <Card><CardHeader><CardTitle>Support and privacy</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center gap-2"><ReportDialog targetType="technical" triggerLabel="Contact support" title="Contact support" /><Button asChild variant="ghost" size="sm"><Link href="/privacy">Privacy summary</Link></Button>{p.roles.includes("admin") ? <Button asChild variant="ghost" size="sm"><Link href="/admin">Admin</Link></Button> : null}</CardContent></Card>
    </div>
  </>;
}
