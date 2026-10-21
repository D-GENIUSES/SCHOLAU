"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthHeading } from "@/components/auth/auth-heading";

/** Notification consent is offered on Home, after registration and academic setup. */
export function SignupNotifications({ destination }: {
  owner: string | null; destination: string; hasSession: boolean;
}) {
  const router = useRouter();
  return <>
    <AuthHeading title="Your account is ready" description="Continue to your learning space. If email confirmation is required, we’ll help you finish that first." />
    <Button block onClick={() => { router.replace(destination); router.refresh(); }}>Continue</Button>
  </>;
}
