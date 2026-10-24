import { Bell, ChevronRight, Shield, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/logo";
import { LegalLinks } from "@/components/legal-links";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isActive, studentNav } from "./nav-items";
import { StreakBadge } from "./streak-badge";

export function ShellFrame({ children, pathname = "/home", displayName = "", unread = 0, isAdmin = false, guest = false, avatarPath = null, streak }: {
  children: ReactNode; pathname?: string; displayName?: string; unread?: number; isAdmin?: boolean; guest?: boolean; avatarPath?: string | null; streak?: { current: number; active_today: boolean };
}) {
  const destination = (href: string) => guest ? href === "/home" ? "/home" : `/home?view=${href.slice(1)}` : href;
  const activeLabel = studentNav.find((item) => isActive(pathname, item.href))?.label ?? "Your learning space";
  const account = guest ? <Button asChild size="sm" ><Link href="/sign-in">Sign in</Link></Button> : <>
    <Link href="/people" className="notification-button" aria-label="Find people"><Search className="size-5" aria-hidden /></Link>
    {streak ? <StreakBadge current={streak.current} activeToday={streak.active_today} /> : null}
    <Link href="/notification-settings" className="notification-button" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
      <Bell className="size-5" aria-hidden />
      {unread > 0 ? <span aria-hidden className="notification-badge">{unread > 9 ? "9+" : unread}</span> : null}
    </Link>
    <Link href="/profile" className="header-profile-link" aria-label={`${displayName || "Your"} profile`}>
      <Avatar name={displayName} path={avatarPath} size={40} variant="profile" />
    </Link>
  </>;
  return <div className="student-shell">
    <aside className="desktop-sidebar"><Link href={destination("/home")} aria-label="ScholAu home" className="sidebar-logo"><Logo /></Link>
      <nav aria-label="Main" className="sidebar-nav">{studentNav.map(({ href, label, icon: Icon }) => <Link key={href} href={destination(href)} aria-current={isActive(pathname, href) ? "page" : undefined} className={cn("sidebar-link", isActive(pathname, href) && "is-active")}><Icon className="size-5" /><span>{label}</span>{isActive(pathname, href) ? <ChevronRight className="ml-auto size-4" aria-hidden /> : null}</Link>)}
      {isAdmin ? <Link href="/admin" className="sidebar-link"><Shield className="size-5" aria-hidden />Admin</Link> : null}</nav>
      
      <div className="sidebar-footer">{guest ? <><div><strong>Exploring ScholAu</strong><Link href="/sign-up">Create account</Link></div></> : <><Avatar name={displayName} path={avatarPath} size={40} /><div><strong>{displayName || "Your account"}</strong><Link href="/profile">View profile</Link></div></>}</div>
    </aside>
    <div className="shell-body"><header className="app-header"><Link href={destination("/home")} aria-label="ScholAu home" className="header-brand lg:hidden"><Logo className="header-wordmark" /><Logo compact className="header-mark" /></Link><div className="hidden lg:flex items-center gap-2 text-sm text-ink-muted"><span>ScholAu</span><ChevronRight className="size-3" aria-hidden /><span className="font-semibold text-ink">{activeLabel}</span></div>
      <nav aria-label="Main" className="tablet-nav">{studentNav.map(({ href, label }) => <Link key={href} href={destination(href)} aria-current={isActive(pathname, href) ? "page" : undefined}>{label}</Link>)}</nav>
      <div className="header-account">{guest ? <span className="guest-label hidden sm:inline">Guest mode</span> : null}{account}{isAdmin ? <Link href="/admin" className="notification-button lg:hidden" aria-label="Admin"><Shield className="size-5" aria-hidden /></Link> : null}</div>
    </header><main id="main" tabIndex={-1} className="app-main">{children}{guest ? <footer className="mt-8 border-t border-line pt-5"><LegalLinks /></footer> : null}</main></div>
    <nav aria-label="Main" className="mobile-navigation"><ul>{studentNav.map(({ href, label, icon: Icon }) => <li key={href}><Link href={destination(href)} aria-current={isActive(pathname, href) ? "page" : undefined}><span className="nav-icon"><Icon className="nav-icon-svg" /></span><span className="nav-label">{label}</span></Link></li>)}</ul></nav>
  </div>;
}
