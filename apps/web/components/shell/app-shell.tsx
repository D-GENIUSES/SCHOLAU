"use client";
import { usePathname } from "next/navigation";
import type { HomeSummary, Profile } from "@scholau/api";
import type { ReactNode } from "react";
import { useHomeSummary, useProfile, useUserSignals } from "@scholau/api/react";
import { ShellFrame } from "./shell-frame";
import { BattleChallengeAlert } from "@/components/battle/battle-challenge-alert";

export function AppShell({
  children,
  userId,
  isAdmin,
  initialProfile,
  initialHome,
}: {
  children: ReactNode;
  userId: string;
  isAdmin: boolean;
  initialProfile?: Profile;
  initialHome?: HomeSummary;
}) {
  const pathname = usePathname();
  const { data } = useHomeSummary(initialHome);
  const profile = useProfile(true, initialProfile);
  useUserSignals(userId);
  return (
    <>
      <BattleChallengeAlert />
      <ShellFrame
        avatarPath={profile.data?.avatar_path}
        pathname={pathname}
        isAdmin={isAdmin}
        displayName={data?.display_name}
        unread={data?.unread_notifications}
        streak={data?.streak}
      >
        {children}
      </ShellFrame>
    </>
  );
}
