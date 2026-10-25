import type { ReactNode } from "react";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { UserPresence } from "@/components/shell/user-presence";
import { FocusShell } from "@/components/shell/focus-shell";
import { requireOnboardedSession } from "@/lib/session";

export default async function FocusLayout({ children }: { children: ReactNode }) {
  const session = await requireOnboardedSession("/home");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  return <><UserPresence userId={session.userId} /><FocusShell>{children}</FocusShell></>;
}
