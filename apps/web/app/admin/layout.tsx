import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Logo } from "@/components/logo";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

function AdministratorAccessRequired() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <span className="inline-flex size-12 items-center justify-center rounded-pill bg-danger-bg text-danger" aria-hidden>
        <ShieldAlert className="size-6" />
      </span>
      <h1 className="text-2xl font-bold">Administrator access required</h1>
      <p className="text-ink-muted">Your account doesn&apos;t have the administrator role, so the admin area isn&apos;t available.</p>
      <Link
        href="/home"
        className="inline-flex min-h-12 items-center rounded-control bg-brand-primary px-5 font-semibold text-ink-inverse hover:bg-brand-primary-hover"
      >
        Back to ScholAu
      </Link>
    </main>
  );
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireSession("/admin");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  const mayShowAdminUi = session.profile.roles.includes("admin");
  if (!mayShowAdminUi) return <AdministratorAccessRequired />;
  return <AdminShell>{children}</AdminShell>;
}
