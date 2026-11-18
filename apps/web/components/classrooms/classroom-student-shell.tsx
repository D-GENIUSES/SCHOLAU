import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { getSessionApi, requireOnboardedSession } from "@/lib/session";

export async function ClassroomStudentShell({ children, nextPath }: { children: ReactNode; nextPath: string }) {
  const session = await requireOnboardedSession(nextPath);
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  const summary = await getSessionApi().then(api => api.getHomeSummary()).catch(() => undefined);
  return <AppShell userId={session.userId} initialProfile={session.profile} initialHome={summary} isAdmin={session.profile.roles.includes("admin")}>
    {children}
  </AppShell>;
}
