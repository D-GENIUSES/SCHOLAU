import { Bell, ChevronRight, Flame, Shield } from "lucide-react";
import { NavLink } from "./nav-link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isActive, studentNav } from "./nav-items";

export function ShellFrame({ children, pathname = "/home", displayName = "", unread = 0, isAdmin = false, guest = false, avatarPath = null, streak }: {
  children: ReactNode; pathname?: string; displayName?: string; unread?: number; isAdmin?: boolean; guest?: boolean; avatarPath?: string | null; streak?: { current: number; active_today: boolean };
}) {
  const destination = (href: string) => guest ? href === "/home" ? "/home" : `/home?view=${href.slice(1)}` : href;
  const activeLabel = studentNav.find((item) => isActive(pathname, item.href))?.label ?? "Your learning space";
  const account = guest ? <Button asChild size="sm" ><NavLink href="/sign-in">Sign in</NavLink></Button> : <>
    {streak ? <span className="header-streak" data-active={streak.active_today} role="status" aria-label={`${streak.current}-day streak${streak.active_today ? ", active today" : ""}`}>
      <Flame className="size-4" fill={streak.active_today ? "currentColor" : "none"} aria-hidden />
      <span key={streak.current} className="streak-count">{streak.current}</span>
    </span> : null}
    <NavLink href="/notification-settings" className="notification-button" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}><Bell className="size-5" aria-hidden />{unread > 0 ? <span aria-hidden className="notification-dot" /> : null}</NavLink>
    <NavLink href="/profile" className="inline-flex shrink-0 rounded-full" aria-label={`${displayName || "Your"} profile`}><Avatar name={displayName} path={avatarPath} size={40} /></NavLink>
  </>;
  return <div className="student-shell">
    <aside className="desktop-sidebar"><NavLink href={destination("/home")} aria-label="ScholAu home" className="sidebar-logo"><Logo /></NavLink>
      <nav aria-label="Main" className="sidebar-nav">{studentNav.map(({ href, label, icon: Icon }) => <NavLink key={href} href={destination(href)} aria-current={isActive(pathname, href) ? "page" : undefined} className={cn("sidebar-link", isActive(pathname, href) && "is-active")}><Icon className="size-5" aria-hidden /><span>{label}</span>{isActive(pathname, href) ? <ChevronRight className="ml-auto size-4" aria-hidden /> : null}</NavLink>)}
      {isAdmin ? <NavLink href="/admin" className="sidebar-link"><Shield className="size-5" aria-hidden />Admin</NavLink> : null}</nav>
      
      <div className="sidebar-footer">{guest ? <><div><strong>Exploring ScholAu</strong><NavLink href="/sign-up">Create account</NavLink></div></> : <><Avatar name={displayName} path={avatarPath} size={40} /><div><strong>{displayName || "Your account"}</strong><NavLink href="/profile">View profile</NavLink></div></>}</div>
    </aside>
    <div className="shell-body"><header className="app-header"><NavLink href={destination("/home")} aria-label="ScholAu home" className="lg:hidden"><Logo /></NavLink><div className="hidden lg:flex items-center gap-2 text-sm text-ink-muted"><span>ScholAu</span><ChevronRight className="size-3" aria-hidden /><span className="font-semibold text-ink">{activeLabel}</span></div>
      <nav aria-label="Main" className="tablet-nav">{studentNav.map(({ href, label }) => <NavLink key={href} href={destination(href)} aria-current={isActive(pathname, href) ? "page" : undefined}>{label}</NavLink>)}</nav>
      <div className="header-account">{guest ? <span className="guest-label hidden sm:inline">Guest mode</span> : null}{account}{isAdmin ? <NavLink href="/admin" className="notification-button lg:hidden" aria-label="Admin"><Shield className="size-5" aria-hidden /></NavLink> : null}</div>
    </header><main id="main" tabIndex={-1} className="app-main">{children}</main></div>
    <nav aria-label="Main" className="mobile-navigation"><ul>{studentNav.map(({ href, label, icon: Icon }) => <li key={href}><NavLink href={destination(href)} aria-current={isActive(pathname, href) ? "page" : undefined}><span className="nav-icon"><Icon className="size-5" aria-hidden /></span><span>{label}</span></NavLink></li>)}</ul></nav>
  </div>;
}
