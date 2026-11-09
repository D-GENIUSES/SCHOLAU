import type { ReactNode } from "react";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { AppShell } from "@/components/shell/app-shell";
import { getSessionApi, requireOnboardedSession } from "@/lib/session";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const summaryRequest = getSessionApi().then((api) => api.getHomeSummary()).catch(() => undefined);
  const session = await requireOnboardedSession("/home");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  const summary = await summaryRequest;
  return (
    <AppShell userId={session.userId} initialProfile={session.profile} initialHome={summary} isAdmin={session.profile.roles.includes("admin")}>
      {children}
    </AppShell>
  );
}
