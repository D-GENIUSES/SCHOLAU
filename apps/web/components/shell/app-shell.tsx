"use client";

import { Bell, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useHomeSummary, useUserSignals } from "@scholau/api/react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { isActive, studentNav } from "./nav-items";

function NotificationsLink({ className }: { className?: string }) {
  const { data } = useHomeSummary();
  const unread = data?.unread_notifications ?? 0;
  return (
    <Link
      href="/notifications"
      className={cn(
        "relative inline-flex size-11 items-center justify-center rounded-control text-ink-muted hover:bg-surface-tint hover:text-ink",
        className,
      )}
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 ? (
        <span className="absolute right-1.5 top-1.5 min-w-5 rounded-pill bg-brand-primary px-1 text-center text-xs font-bold leading-5 text-ink-inverse" aria-hidden>
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Student shell: 240px sidebar on desktop (>=1024), top navigation on tablet (768-1023), fixed bottom
 * navigation with safe-area inset on mobile (<768).
 */
export function AppShell({ children, userId, isAdmin }: { children: ReactNode; userId: string; isAdmin: boolean }) {
  const pathname = usePathname();
  useUserSignals(userId);

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r border-line bg-surface-card lg:flex">
        <div className="flex h-20 items-center px-6">
          <Link href="/home" aria-label="ScholAu home">
            <Logo />
          </Link>
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
          {studentNav.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-control px-3 font-semibold transition-colors",
                  active ? "bg-surface-tint text-brand-primary" : "text-ink-muted hover:bg-surface-page hover:text-ink",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            );
          })}
          {isAdmin ? (
            <Link
              href="/admin"
              className="mt-4 flex min-h-12 items-center gap-3 rounded-control px-3 font-semibold text-ink-muted hover:bg-surface-page hover:text-ink"
            >
              <Shield className="size-5" aria-hidden />
              Admin
            </Link>
          ) : null}
        </nav>
        <div className="flex items-center justify-between border-t border-line px-6 py-4">
          <span className="text-sm text-ink-muted">Study. Compete. Rise.</span>
          <NotificationsLink />
        </div>
      </aside>

      {/* Tablet / mobile header */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface-card/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-3 px-4">
          <Link href="/home" aria-label="ScholAu home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {studentNav.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold",
                    active ? "bg-surface-tint text-brand-primary" : "text-ink-muted hover:text-ink",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-1">
            {isAdmin ? (
              <Link href="/admin" className="inline-flex size-11 items-center justify-center rounded-control text-ink-muted hover:bg-surface-tint" aria-label="Admin">
                <Shield className="size-5" aria-hidden />
              </Link>
            ) : null}
            <NotificationsLink />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mb-bottom-nav md:pb-10 lg:pl-sidebar">
        <div className="mx-auto w-full max-w-content px-4 py-6 md:px-6 lg:px-8 lg:py-10">{children}</div>
      </main>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-card md:hidden">
        <ul className="grid grid-cols-5">
          {studentNav.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold",
                    active ? "text-brand-primary" : "text-ink-muted",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  <span className="max-w-full truncate">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
