import type { ReactNode } from "react";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { AppShell } from "@/components/shell/app-shell";
import { requireOnboardedSession } from "@/lib/session";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const session = await requireOnboardedSession("/home");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  return (
    <AppShell userId={session.userId} isAdmin={session.profile.roles.includes("admin")}>
      {children}
    </AppShell>
  );
}
