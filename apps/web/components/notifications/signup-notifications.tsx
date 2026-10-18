"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthHeading } from "@/components/auth/auth-heading";
import { requestSignupNotifications, enrollPendingNotifications } from "@/lib/push-browser";

/** The click keeps the native permission prompt within Safari's user activation. */
export function SignupNotifications({ owner, destination, hasSession }: {
  owner: string | null; destination: string; hasSession: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function continueToApp() {
    setBusy(true);
    try {
      if (owner) {
        await requestSignupNotifications(owner);
        if (hasSession) await enrollPendingNotifications(owner);
      }
    } catch {
      // Permission denial, unsupported devices or temporary push failures must
      // never block registration/email confirmation. Granted consent can retry.
    }
    router.replace(destination);
    router.refresh();
  }
  return <>
    <AuthHeading title="Your account is ready" description="Continue and choose whether ScholAu can send you notifications when your device asks." />
    <Button block loading={busy} onClick={() => void continueToApp()}>Continue</Button>
  </>;
}
