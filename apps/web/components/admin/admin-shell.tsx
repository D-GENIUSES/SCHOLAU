"use client";

import {
  ArrowLeft,
  BadgeCheck,
  ClipboardCheck,
  Flag,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Swords,
  Upload,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const adminNav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Add users", icon: UserPlus },
  { href: "/admin/lecturer-applications", label: "Lecturer applications", icon: GraduationCap },
  { href: "/admin/import", label: "Import", icon: Upload },
  { href: "/admin/review", label: "Review", icon: ClipboardCheck },
  { href: "/admin/offerings", label: "Offerings", icon: GraduationCap },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/battles", label: "Battles", icon: Swords },
  { href: "/admin/premium", label: "Premium", icon: BadgeCheck },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
] as const;

function isAdminActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <span className="inline-flex items-center gap-2">
      <Link href="/admin" aria-label="ScholAu admin overview">
        <Logo />
      </Link>
      <Badge tone="brand">
        <ShieldCheck className="size-3.5" aria-hidden />
        Admin
      </Badge>
    </span>
  );
}

const serverCheckNote = "Every admin action is re-checked and audited on the server.";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r border-line bg-surface-card lg:flex">
        <div className="flex h-20 items-center px-6">
          <Brand />
        </div>
        <nav aria-label="Admin" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {adminNav.map(({ href, label, icon: Icon }) => {
            const active = isAdminActive(pathname, href);
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
        </nav>
        <div className="flex flex-col gap-3 border-t border-line px-3 py-4">
          <Link
            href="/home"
            className="flex min-h-12 items-center gap-3 rounded-control px-3 font-semibold text-ink-muted hover:bg-surface-page hover:text-ink"
          >
            <ArrowLeft className="size-5" aria-hidden />
            Back to app
          </Link>
          <Link href="/change-password" className="px-3 py-2 text-sm font-semibold">Change password</Link>
          <p className="px-3 text-sm text-ink-muted">{serverCheckNote}</p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-line bg-surface-card/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-2 px-4">
          <Brand />
          <Link href="/change-password" className="text-sm font-semibold">Change password</Link>
          <Link
            href="/home"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm font-semibold text-ink-muted hover:bg-surface-tint hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span>
              Back<span className="hidden sm:inline"> to app</span>
            </span>
          </Link>
        </div>
        <nav aria-label="Admin" className="overflow-x-auto">
          <ul className="mx-auto flex w-max min-w-full max-w-content gap-1 px-4 pb-2">
            {adminNav.map(({ href, label }) => {
              const active = isAdminActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center whitespace-nowrap rounded-control px-3 text-sm font-semibold",
                      active ? "bg-surface-tint text-brand-primary" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="pb-10 lg:pl-sidebar">
        <div className="mx-auto w-full max-w-content px-4 py-6 md:px-6 lg:px-8 lg:py-10">
          {children}
          <p className="mt-10 text-sm text-ink-muted lg:hidden">{serverCheckNote}</p>
        </div>
      </main>
    </div>
  );
}
