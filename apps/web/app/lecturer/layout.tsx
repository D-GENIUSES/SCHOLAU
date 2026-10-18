import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { AccountPhotoLink } from "@/components/profile/account-photo-link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Lecturer workspace", robots: { index: false, follow: false } };
export default async function LecturerLayout({ children }: { children: ReactNode }) {
  const session = await requireSession("/lecturer/application");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  return <div className="min-h-dvh bg-surface-page"><header className="border-b border-line bg-surface-card"><div className="mx-auto flex min-h-20 max-w-content flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6"><Link href="/lecturer" aria-label="Lecturer workspace"><Logo /></Link><nav aria-label="Lecturer navigation" className="flex flex-wrap items-center gap-5 text-sm font-semibold"><Link href="/lecturer" className="text-brand-primary">My courses</Link><Link href="/lecturer/application">Application status</Link><Link href="/notification-settings">Notifications</Link><Link href="/lecturer/announcements">Announcements</Link><Link href="/change-password">Change password</Link><AccountPhotoLink /><SignOutButton /></nav></div></header><main id="main" tabIndex={-1} className="mx-auto max-w-content px-4 py-8 sm:px-6">{children}</main></div>;
}
