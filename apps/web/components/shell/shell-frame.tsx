import { Bell, ChevronRight, GraduationCap, LogIn, Shield } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { initials } from "@scholau/core";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isActive, studentNav } from "./nav-items";

export function ShellFrame({ children, pathname = "/home", displayName = "", unread = 0, isAdmin = false, guest = false }: {
  children: ReactNode; pathname?: string; displayName?: string; unread?: number; isAdmin?: boolean; guest?: boolean;
}) {
  const destination = (href: string) => guest ? href === "/home" ? "/home" : `/home?view=${href.slice(1)}` : href;
  const activeLabel = studentNav.find((item) => isActive(pathname, item.href))?.label ?? "Your learning space";
  const account = guest ? <Button asChild size="sm" className="rounded-pill"><Link href="/sign-in"><LogIn className="size-4 hidden sm:block" aria-hidden />Sign in</Link></Button> : <>
    <Link href="/notifications" className="notification-button" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}><Bell className="size-5" aria-hidden />{unread > 0 ? <span aria-hidden className="notification-dot" /> : null}</Link>
    <Link href="/profile" className="account-avatar" aria-label={`${displayName || "Your"} profile`}>{initials(displayName)}</Link>
  </>;
  return <div className="student-shell">
    <aside className="desktop-sidebar"><Link href={destination("/home")} aria-label="ScholAu home" className="sidebar-logo"><Logo /></Link>
      <p className="sidebar-caption">LEARN. PLAY. LEVEL UP.</p><nav aria-label="Main" className="sidebar-nav">{studentNav.map(({ href, label, icon: Icon }) => <Link key={href} href={destination(href)} aria-current={isActive(pathname, href) ? "page" : undefined} className={cn("sidebar-link", isActive(pathname, href) && "is-active")}><Icon className="size-5" aria-hidden /><span>{label}</span>{isActive(pathname, href) ? <ChevronRight className="ml-auto size-4" aria-hidden /> : null}</Link>)}
      {isAdmin ? <Link href="/admin" className="sidebar-link"><Shield className="size-5" aria-hidden />Admin</Link> : null}</nav>
      <div className="sidebar-motivation"><span className="icon-tile"><GraduationCap className="size-6" aria-hidden /></span><strong>Your future starts here.</strong><p>One lesson. One challenge.<br />A little better every day.</p></div>
      <div className="sidebar-footer">{guest ? <><span className="account-avatar"><GraduationCap className="size-5" aria-hidden /></span><div><strong>Exploring ScholAu</strong><Link href="/sign-up">Create your account →</Link></div></> : <><span className="account-avatar">{initials(displayName)}</span><div><strong>{displayName || "Your account"}</strong><Link href="/profile">View profile →</Link></div></>}</div>
    </aside>
    <div className="shell-body"><header className="app-header"><Link href={destination("/home")} aria-label="ScholAu home" className="lg:hidden"><Logo /></Link><div className="hidden lg:flex items-center gap-2 text-sm text-ink-muted"><span>ScholAu</span><ChevronRight className="size-3" aria-hidden /><span className="font-semibold text-ink">{activeLabel}</span></div>
      <nav aria-label="Main" className="tablet-nav">{studentNav.map(({ href, label }) => <Link key={href} href={destination(href)} aria-current={isActive(pathname, href) ? "page" : undefined}>{label}</Link>)}</nav>
      <div className="header-account">{guest ? <span className="guest-label hidden sm:inline">Guest mode</span> : null}{account}{isAdmin ? <Link href="/admin" className="notification-button lg:hidden" aria-label="Admin"><Shield className="size-5" aria-hidden /></Link> : null}</div>
    </header><main id="main" tabIndex={-1} className="app-main">{children}</main></div>
    <nav aria-label="Main" className="mobile-navigation"><ul>{studentNav.map(({ href, label, icon: Icon }) => <li key={href}><Link href={destination(href)} aria-current={isActive(pathname, href) ? "page" : undefined}><span className="nav-icon"><Icon className="size-5" aria-hidden /></span><span>{label}</span></Link></li>)}</ul></nav>
  </div>;
}
