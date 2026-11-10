"use client";

import { BookOpen, ChevronDown, FileText, Inbox, Megaphone, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const workspaceLinks = [
  { href: "/lecturer", label: "My courses", icon: BookOpen },
  { href: "/lecturer/materials", label: "Materials", icon: FileText },
  { href: "/lecturer/submissions", label: "Submissions", icon: Inbox },
  { href: "/lecturer/announcements", label: "Announcements", icon: Megaphone },
];
const application = { href: "/lecturer/application", label: "Application status", icon: FileText };

const accountLinks = [
  { href: "/account/photo", label: "Profile photo" },
  { href: "/notification-settings", label: "Notifications" },
  { href: "/change-password", label: "Change password" },
];

const navLink =
  "flex min-h-10 items-center gap-2.5 rounded-control px-2.5 py-1.5 text-sm font-semibold hover:bg-surface-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";

function WorkspaceNavigation({ canTeach, mobile = false }: { canTeach: boolean; mobile?: boolean }) {
  const path = usePathname();
  const links = canTeach ? workspaceLinks : [application];
  return (
    <nav aria-label="Lecturer navigation" className="flex flex-col gap-0.5">
      {links.map(({ href, label, icon: Icon }) => {
        const current = path === href || (href === "/lecturer" && path.startsWith("/lecturer/courses/"));
        const link = (
          <Link href={href} aria-current={current ? "page" : undefined} className={cn(navLink, current && "bg-surface-tint text-brand-primary")}>
            <Icon className="size-4 shrink-0" aria-hidden /> {label}
          </Link>
        );
        return mobile ? <DialogClose asChild key={href}>{link}</DialogClose> : <div key={href}>{link}</div>;
      })}
    </nav>
  );
}

function AccountMenu({ name, avatar, mobile = false }: { name: string; avatar?: string | null; mobile?: boolean }) {
  const safeName = name?.trim() || "Lecturer";
  const initials = safeName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]).join("").toUpperCase();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" aria-label="Account menu" className={cn(navLink, mobile ? "justify-center px-1" : "w-full justify-start")}>
          {avatar ? <Avatar name={safeName} path={avatar} size={32} /> : (
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-tint text-[10px] font-bold text-brand-primary">{initials || "SA"}</span>
          )}
          {!mobile ? <><span className="min-w-0 flex-1 truncate text-left text-sm">{safeName}</span><ChevronDown className="size-3.5 shrink-0 text-ink-muted" aria-hidden /></> : null}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogTitle>Account</DialogTitle>
        <DialogDescription className="break-words">{safeName}</DialogDescription>
        <div className="space-y-0.5">
          {accountLinks.map(({ href, label }) => (
            <DialogClose key={href} asChild><Link href={href} className={navLink}>{label}</Link></DialogClose>
          ))}
          <div className="mt-2 border-t border-line pt-2">
            <SignOutButton className="min-h-10 w-full justify-start" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LecturerWorkspaceShell({
  children, name, avatar, canTeach,
}: {
  children: ReactNode;
  name: string;
  avatar?: string | null;
  canTeach: boolean;
}) {
  const home = canTeach ? "/lecturer" : "/lecturer/application";
  return (
    <div className="lecturer-shell min-h-dvh bg-surface-page md:grid md:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-line bg-surface-page px-3 pb-3 pt-5 md:flex">
        <Link href={home} className="self-start rounded-control px-1.5 focus-visible:outline-2 focus-visible:outline-brand-primary"><Logo className="h-6" /></Link>
        <p className="mb-4 mt-1.5 px-1.5 text-xs font-medium text-ink-muted">Lecturer</p>
        <WorkspaceNavigation canTeach={canTeach} />
        <div className="mt-auto pt-4">
          <div className="border-t border-line pt-2"><AccountMenu name={name} avatar={avatar} /></div>
        </div>
      </aside>
      <header className="grid min-h-12 grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2 border-b border-line bg-surface-page px-3 md:hidden">
        <Dialog>
          <DialogTrigger asChild>
            <button type="button" aria-label="Open lecturer navigation" className={cn(navLink, "justify-center p-0")}><Menu className="size-5" aria-hidden /></button>
          </DialogTrigger>
          <DialogContent className="max-w-xs">
            <DialogTitle className="text-base">Navigate</DialogTitle>
            <DialogDescription className="sr-only">Choose a section of your workspace.</DialogDescription>
            <WorkspaceNavigation canTeach={canTeach} mobile />
          </DialogContent>
        </Dialog>
        <Link href={home} className="flex min-h-10 items-center justify-center rounded-control focus-visible:outline-2 focus-visible:outline-brand-primary"><Logo className="h-6" /></Link>
        <AccountMenu name={name} avatar={avatar} mobile />
      </header>
      <main id="main" tabIndex={-1} className="lecturer-main mx-auto w-full min-w-0 max-w-5xl px-4 py-5 sm:px-5 md:px-6 md:py-6">
        {children}
      </main>
    </div>
  );
}
