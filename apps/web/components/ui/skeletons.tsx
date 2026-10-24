"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Skeleton } from "./misc";
import { LoadingState } from "./states";

function Status({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <Status label="Getting your learning space ready…">
      <div className="home-dashboard compact-home" aria-hidden>
        <div className="home-welcome">
          <Skeleton className="h-7 w-56 max-w-full" />
          <div className="home-stats">
            <Skeleton className="h-[58px] rounded-[14px]" />
            <Skeleton className="h-[58px] rounded-[14px]" />
          </div>
        </div>
        <div className="compact-home-grid">
          <div className="compact-home-main">
            <div className="learning-spotlight">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-6 w-4/5" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-2/3" />
              <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
              <Skeleton className="mt-4 h-10 w-36 rounded-full" />
            </div>
            <div className="home-action-grid">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="home-action-tile">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-28" />
                  </span>
                </div>
              ))}
            </div>
          </div>
          <aside className="compact-home-aside">
            <div>
              <Skeleton className="mb-3 h-4 w-32" />
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="course-row">
                    <Skeleton className="size-10 shrink-0 rounded-full" />
                    <span className="flex min-w-0 flex-1 flex-col gap-2">
                      <Skeleton className="h-3.5 w-3/5" />
                      <Skeleton className="h-3 w-2/5" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[16px] border border-[#e2eaf4] bg-white p-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-4 h-2 w-full rounded-full" />
              <Skeleton className="mt-3 h-3 w-1/2" />
            </div>
          </aside>
        </div>
      </div>
    </Status>
  );
}

export function ProfileSkeleton() {
  return (
    <Status label="Loading your profile…">
      <div className="compact-profile" aria-hidden>
        <header className="profile-identity">
          <Skeleton className="size-[72px] shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </header>
        <Skeleton className="h-11 w-full rounded-full" />
        <div className="profile-stat-grid">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="profile-stat rounded-[14px] border border-[#e2eaf4] bg-white">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-[16px] border border-[#e2eaf4] bg-white p-5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-3 h-2 w-full rounded-full" />
        </div>
      </div>
    </Status>
  );
}

export function RouteSkeleton() {
  const pathname = usePathname();
  if (pathname === "/home" || pathname.startsWith("/home/")) return <HomeSkeleton />;
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return <ProfileSkeleton />;
  const label = pathname.startsWith("/study")
    ? "Loading your courses…"
    : pathname.startsWith("/battles")
      ? "Loading battles…"
      : pathname.startsWith("/leaderboard")
        ? "Loading leaderboard…"
        : "Loading…";
  return (
    <div className="flex flex-col gap-4">
      <div aria-hidden>
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-3 h-3.5 w-72 max-w-full" />
      </div>
      <LoadingState label={label} lines={4} />
    </div>
  );
}
