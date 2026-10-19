"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useHomeSummary, useProfile } from "@scholau/api/react";
import { ShellFrame } from "./shell-frame";
import { SplashGate } from "./splash-gate";
import { WarmCache } from "./warm-cache";
export function AppShell({ children, isAdmin }: { children: ReactNode; isAdmin: boolean }) {
  const pathname = usePathname();
  const { data } = useHomeSummary();
  const profile = useProfile();
  return <SplashGate><WarmCache /><ShellFrame avatarPath={profile.data?.avatar_path} pathname={pathname} isAdmin={isAdmin} displayName={data?.display_name} unread={data?.unread_notifications} streak={data?.streak}>{children}</ShellFrame></SplashGate>;
}
