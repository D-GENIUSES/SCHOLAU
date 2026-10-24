"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  BookOpen,
  ClipboardCheck,
  FileUp,
  Flag,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  ShieldCheck,
  Swords,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { AccountPhotoLink } from "@/components/profile/account-photo-link";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

type AdminNavItem = { href: string; label: string; shortLabel?: string; icon: ComponentType<SVGProps<SVGSVGElement>> };

export const adminNavGroups: readonly { label: string; items: readonly AdminNavItem[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "People",
    items: [
      { href: "/admin/users", label: "Users", icon: UserPlus },
      { href: "/admin/lecturer-applications", label: "Lecturer applications", shortLabel: "Lecturers", icon: GraduationCap },
      { href: "/admin/premium", label: "Premium", icon: BadgeCheck },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/import", label: "Import", icon: FileUp },
      { href: "/admin/materials", label: "Upload PDFs (Gemini)", shortLabel: "Upload", icon: FileUp },
      { href: "/admin/review", label: "Review", icon: ClipboardCheck },
      { href: "/admin/offerings", label: "Offerings", icon: GraduationCap },
      { href: "/admin/content-sync", label: "Bundle sync (JSON)", shortLabel: "Bundles", icon: BookOpen },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/admin/announcements", label: "Announcements", shortLabel: "Announce", icon: Megaphone },
      { href: "/admin/reports", label: "Reports", icon: Flag },
      { href: "/admin/battles", label: "Battles", icon: Swords },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/audit", label: "Audit log", shortLabel: "Audit", icon: ScrollText },
      { href: "/notification-settings", label: "Notifications", shortLabel: "Alerts", icon: Bell },
    ],
  },
] as const;

const flatAdminNav = adminNavGroups.flatMap((g) => g.items);

function isAdminActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Link href="/admin" aria-label="ScholAu admin overview" className="shrink-0">
        <Logo />
      </Link>
      <Badge tone="brand" className="hidden px-2 py-0.5 text-[10px] sm:inline-flex">
        <ShieldCheck className="size-3" aria-hidden />
        Admin
      </Badge>
    </span>
  );
}

const navLinkClass = (active: boolean) =>
  cn(
    "flex min-h-9 items-center gap-2.5 rounded-control px-2.5 text-[13px] font-semibold leading-tight transition-colors",
    active ? "bg-surface-tint text-brand-primary" : "text-ink-muted hover:bg-surface-page hover:text-ink",
  );

const serverCheckNote = "Every admin action is re-checked and audited on the server.";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-surface-page">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col border-r border-line bg-surface-card lg:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-line px-4">
          <Brand />
        </div>
        <nav aria-label="Admin" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
          {adminNavGroups.map((group) => (
            <div key={group.label} className="pb-1">
              <p className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted first:pt-0">{group.label}</p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isAdminActive(pathname, href);
                  return (
                    <li key={href}>
                      <Link href={href} aria-current={active ? "page" : undefined} className={navLinkClass(active)}>
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="flex shrink-0 flex-col gap-1 border-t border-line px-2 py-3">
          <Link href="/home" className={navLinkClass(false)}>
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Back to app
          </Link>
          <div className="px-1">
            <AccountPhotoLink showLabel />
          </div>
          <Link href="/change-password" className="px-2.5 py-1.5 text-xs font-semibold text-brand-primary hover:underline">
            Change password
          </Link>
          <p className="px-2.5 text-[11px] leading-snug text-ink-muted">{serverCheckNote}</p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-line bg-surface-card/95 backdrop-blur lg:hidden">
        <div className="flex min-h-12 items-center justify-between gap-2 px-3 py-2">
          <Brand />
          <div className="flex shrink-0 items-center gap-1">
            <AccountPhotoLink />
            <Link
              href="/home"
              className="inline-flex min-h-9 items-center gap-1 rounded-control px-2 text-xs font-semibold text-ink-muted hover:bg-surface-tint hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              App
            </Link>
          </div>
        </div>
        <nav aria-label="Admin" className="border-t border-line">
          <ul className="flex gap-1 overflow-x-auto px-3 py-2">
            {flatAdminNav.map(({ href, label, shortLabel }) => {
              const active = isAdminActive(pathname, href);
              return (
                <li key={href} className="shrink-0">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-8 items-center whitespace-nowrap rounded-pill px-2.5 text-xs font-semibold",
                      active ? "bg-surface-tint text-brand-primary" : "text-ink-muted hover:bg-surface-page hover:text-ink",
                    )}
                  >
                    {shortLabel ?? label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="pb-8 lg:pl-[220px]">
        <div className="mx-auto w-full max-w-content px-3 py-4 md:px-5 lg:px-6 lg:py-6">{children}</div>
        <p className="mx-auto max-w-content px-3 pb-4 text-[11px] text-ink-muted lg:hidden">{serverCheckNote}</p>
      </main>
    </div>
  );
}
