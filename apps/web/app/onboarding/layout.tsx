import type { ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/logo";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { requireSession } from "@/lib/session";

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  // requireSession, not requireOnboardedSession: this is where un-onboarded users are sent.
  const session = await requireSession("/onboarding");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface-card">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-3 px-4">
          <Logo />
          <SignOutButton />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
