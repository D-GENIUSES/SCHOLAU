"use client";
import { UserPresence } from "./user-presence";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useHomeSummary, useProfile, useUserSignals } from "@scholau/api/react";
import { ShellFrame } from "./shell-frame";
import { BattleChallengeAlert } from "@/components/battle/battle-challenge-alert";
export function AppShell({ children, userId, isAdmin }: { children: ReactNode; userId: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const { data } = useHomeSummary();
  const profile = useProfile();
  useUserSignals(userId);
  return <><UserPresence userId={userId} /><BattleChallengeAlert /><ShellFrame avatarPath={profile.data?.avatar_path} pathname={pathname} isAdmin={isAdmin} displayName={data?.display_name} unread={data?.unread_notifications} streak={data?.streak}>{children}</ShellFrame></>;
}
