"use client";

import { BookOpen, ClipboardCheck, Flame, Shield, Star, Swords, Trophy } from "lucide-react";
import Link from "next/link";
import { useProfile } from "@scholau/api/react";
import { formatNumber, formatStreak, formatXp, initials } from "@scholau/core";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ReportDialog } from "@/components/report-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Stat } from "@/components/ui/misc";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { AccountDeletionDialog } from "./account-deletion-dialog";
import { AcademicDetailsCard } from "./academic-details-card";
import { ProfileEditForm } from "./profile-edit-form";

export function ProfileView() {
  const profile = useProfile();

  if (profile.isPending) return <LoadingState label="Loading your profile…" lines={4} />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;

  const p = profile.data;
  const isAdmin = p.roles.includes("admin");

  return (
    <>
      <PageHeader title="Profile" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label="Identity" className="flex items-center gap-4">
            <span
              className="inline-flex size-16 shrink-0 items-center justify-center rounded-pill bg-brand-primary text-xl font-bold text-ink-inverse"
              aria-hidden
            >
              {initials(p.display_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold text-ink">{p.display_name}</p>
              {p.academic ? (
                <p className="text-ink-muted">
                  {p.academic.level.label} · {p.academic.department.name}
                </p>
              ) : null}
            </div>
          </section>

          <AcademicDetailsCard academic={p.academic} />
          <ProfileEditForm profile={p} />

          <Card>
            <CardHeader>
              <CardTitle>Support and privacy</CardTitle>
              <CardDescription>Get help with your account or read how we handle your data.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <ReportDialog targetType="technical" triggerLabel="Contact support" title="Contact support" />
              <Button asChild variant="ghost" size="sm">
                <Link href="/privacy">Privacy summary</Link>
              </Button>
              {isAdmin ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin">
                    <Shield className="size-4" aria-hidden />
                    Admin
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <SignOutButton variant="outline" size="md" />
              <AccountDeletionDialog />
            </CardContent>
          </Card>
        </div>

        <aside aria-label="Your progress" className="flex flex-col gap-6">
          <section aria-labelledby="xp-title" className="flex flex-col gap-3">
            <h2 id="xp-title" className="text-lg font-bold">
              XP and streak
            </h2>
            <Stat label="Lifetime XP" value={formatXp(p.xp_total)} icon={<Star className="size-5" />} />
            <Stat label="Current streak" value={formatStreak(p.streak.current)} icon={<Flame className="size-5" />} />
            <Stat label="Longest streak" value={formatStreak(p.streak.longest)} icon={<Trophy className="size-5" />} />
          </section>
          <section aria-labelledby="stats-title" className="flex flex-col gap-3">
            <h2 id="stats-title" className="text-lg font-bold">
              Learning stats
            </h2>
            <Stat label="Lessons completed" value={formatNumber(p.learning_totals.lessons_completed)} icon={<BookOpen className="size-5" />} />
            <Stat
              label="Assessments completed"
              value={formatNumber(p.learning_totals.assessments_completed)}
              icon={<ClipboardCheck className="size-5" />}
            />
            <Stat label="Battles completed" value={formatNumber(p.learning_totals.battles_completed)} icon={<Swords className="size-5" />} />
          </section>
        </aside>
      </div>
    </>
  );
}
