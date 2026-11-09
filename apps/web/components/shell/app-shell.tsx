"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { HomeSummary, Profile } from "@scholau/api";
import type { ReactNode } from "react";
import { useHomeSummary, useProfile, useUserSignals } from "@scholau/api/react";
import { ShellFrame } from "./shell-frame";
import { BattleChallengeAlert } from "@/components/battle/battle-challenge-alert";
import { agentDebugLog } from "@/lib/agent-debug-log";
export function AppShell({ children, userId, isAdmin, initialProfile, initialHome }: { children: ReactNode; userId: string; isAdmin: boolean; initialProfile?: Profile; initialHome?: HomeSummary }) {
  const pathname = usePathname();
  const shellMount = useRef(Date.now());
  const { data, isFetching, isPending, dataUpdatedAt, fetchStatus } = useHomeSummary(initialHome);
  useEffect(() => {
    if (isPending || isFetching) return;
    // #region agent log
    agentDebugLog({
      location: "app-shell.tsx:home",
      message: "home summary ready",
      data: { pathname, hadInitialHome: Boolean(initialHome), shellMs: Date.now() - shellMount.current, fetchStatus, dataUpdatedAt },
      hypothesisId: "C",
      runId: "post-fix",
    });
    // #endregion
  }, [isPending, isFetching, pathname, initialHome, fetchStatus, dataUpdatedAt]);
  const profile = useProfile(true, initialProfile);
  useUserSignals(userId);
  return <><BattleChallengeAlert /><ShellFrame avatarPath={profile.data?.avatar_path} pathname={pathname} isAdmin={isAdmin} displayName={data?.display_name} unread={data?.unread_notifications} streak={data?.streak}>{children}</ShellFrame></>;
}
