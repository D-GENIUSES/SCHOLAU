"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useHomeSummary, useUserSignals } from "@scholau/api/react";
import { ShellFrame } from "./shell-frame";
import { SplashGate } from "./splash-gate";
export function AppShell({ children, userId, isAdmin }: { children: ReactNode; userId: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const { data } = useHomeSummary();
  useUserSignals(userId);
  return <SplashGate><ShellFrame pathname={pathname} isAdmin={isAdmin} displayName={data?.display_name} unread={data?.unread_notifications}>{children}</ShellFrame></SplashGate>;
}
