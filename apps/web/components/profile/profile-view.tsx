"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight, BookOpen, GraduationCap, Settings, Swords } from "lucide-react";
import { useFriends, useProfile } from "@scholau/api/react";
import { formatNumber, formatStreak, NIGERIAN_UNIVERSITIES, xpProgress, type RegistrationAcademicInput } from "@scholau/core";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { StreakFlame } from "@/components/icons/streak-flame";
import { ProfileOverview, ProfileBadges } from "./profile-panels";

const ProfileSettings = dynamic(() => import("./profile-settings").then(m => m.ProfileSettings));
const ProfileEditForm = dynamic(() => import("./profile-edit-form").then(m => m.ProfileEditForm));
const ProfileFriends = dynamic(() => import("./profile-friends").then(m => m.ProfileFriends));

export function ProfileView({ registration = null, email = null }: { registration?: RegistrationAcademicInput | null; email?: string | null }) {
  const [tab, setTab] = useState<"overview" | "badges" | "friends">("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const profile = useProfile();
  const friends = useFriends();
  const requestCount = friends.data?.people.filter(p => p.state === "pending" && p.incoming).length ?? 0;
  if (profile.isPending) return <LoadingState variant="profile" label="Loading your profile…" lines={3} />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
  const p = profile.data;
  const progress = xpProgress(p.xp_total);
  const university = p.academic?.university.name ?? NIGERIAN_UNIVERSITIES.find(item => item.value === registration?.universitySlug)?.label;
  const academicLine = [p.academic?.department.name ?? registration?.department, p.academic?.level.label].filter(Boolean).join(" · ");
  return (
    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <div className="profile-simple">
        {settingsOpen ? <ProfileSettings profile={p} registration={registration} email={email} onEdit={() => setEditOpen(true)} onClose={() => {
          setSettingsOpen(false);
          requestAnimationFrame(() => settingsButton.current?.focus());
        }} /> : <>
          <header className="ps-top"><span>My profile</span><Button ref={settingsButton} variant="ghost" size="icon" aria-label="Settings" onClick={() => setSettingsOpen(true)}><Settings aria-hidden className="size-5" /></Button></header>
          <section className="ps-identity" aria-label="Your profile">
            <Link href={`/people/${p.id}`} aria-label="View your public profile" className="rounded-full focus-visible:outline-2 focus-visible:outline-brand-primary"><Avatar name={p.display_name} path={p.avatar_path} size={56} variant="profile" eager /></Link>
            <div className="ps-identity-copy"><h1>{p.display_name}</h1>{p.username ? <p>@{p.username}</p> : null}{academicLine ? <p className="ps-academic">{academicLine}</p> : null}{university ? <p className="ps-university">{university}</p> : null}</div>
            <Button variant="outline" size="sm" className="ps-edit" onClick={() => setEditOpen(true)}>Edit profile</Button>
          </section>
          <div className="ps-public"><Link href={`/people/${p.id}`}>View public profile <ArrowUpRight aria-hidden /></Link></div>
          <section className="ps-progress" aria-label="Learning progress">
            <div className="ps-metrics">
              <div><GraduationCap aria-hidden /><strong>Level {progress.level}</strong></div>
              <div data-profile-xp><strong>{formatNumber(p.xp_total)} <span>XP</span></strong></div>
              <div><StreakFlame active={p.streak.active_today} size={18} /><strong><span className="sr-only">Current streak: </span>{formatStreak(p.streak.current)}<span className="ps-streak-label"> streak</span></strong></div>
            </div>
            <Progress value={100 * progress.earned / progress.required} label={`Progress to level ${progress.level + 1}`} />
            <p className="ps-progress-caption">{formatNumber(progress.required - progress.earned)} XP to Level {progress.level + 1}</p>
          </section>
          <Segmented name="profile-view" legend="Profile section" value={tab} onChange={setTab} equalWidth className="ps-tabs" options={[
            { value: "overview", label: "Overview" }, { value: "badges", label: "Badges" }, { value: "friends", label: requestCount ? `Friends (${requestCount})` : "Friends" },
          ]} />
          <section className="ps-body" aria-label={tab === "overview" ? "Overview" : tab === "badges" ? "Badges" : "Friends"}>
            {tab === "overview" ? <><div className="ps-completions"><span><BookOpen aria-hidden /><strong>{formatNumber(p.learning_totals.lessons_completed)}</strong> lessons completed</span><span><Swords aria-hidden /><strong>{formatNumber(p.learning_totals.battles_completed)}</strong> battles completed</span></div><ProfileOverview /></> : tab === "badges" ? <ProfileBadges /> : <div className="ps-friends"><ProfileFriends /></div>}
          </section>
        </>}
      </div>
      <DialogContent><DialogTitle>Edit profile</DialogTitle><DialogDescription>Update your photo, username and leaderboard visibility.</DialogDescription>{editOpen ? <ProfileEditForm key={p.id} profile={p} /> : null}</DialogContent>
    </Dialog>
  );
}
