"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { emailSchema } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { authErrorMessage } from "./auth-errors";
import { AuthHeading } from "./auth-heading";

const COOLDOWN_SECONDS = 60;

export function VerifyPanel({ email: initialEmail, lecturer = false }: { email?: string; lecturer?: boolean }) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const resend = async () => {
    if (sending || cooldown > 0) return;
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setStatus({ tone: "error", text: parsed.error.issues[0]?.message ?? "Enter a valid email address." });
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      const { error } = await getBrowserSupabase().auth.resend({
        type: "signup",
        email: parsed.data,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/continue` },
      });
      setSending(false);
      if (error) {
        setStatus({ tone: "error", text: authErrorMessage(error) });
        return;
      }
      setCooldown(COOLDOWN_SECONDS);
      setStatus({ tone: "ok", text: "Email sent. Check your inbox and spam folder." });
    } catch {
      setStatus({ tone: "error", text: "The email could not be sent. Check your connection and try again." });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <AuthHeading
        title="Check your email"
        description={
          initialEmail ? (
            <>
              We sent a confirmation link to <strong className="break-all text-ink">{initialEmail}</strong>.
            </>
          ) : (
            "We sent a confirmation link to the email address you signed up with."
          )
        }
      />
      <div className="flex flex-col gap-4">
        <p className="text-ink-muted">
          {lecturer ? "Confirm your email address to continue. Your lecturer application still requires administrator approval; confirming your email does not activate teaching access." : "Open the confirmation link to continue directly to ScholAu."} The link expires after a while, so use it soon.
        </p>
        {initialEmail ? null : (
          <Field id="verify-email" label="Email">
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        )}
        <Button variant="outline" block loading={sending} disabled={cooldown > 0} onClick={() => void resend()}>
          {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend email"}
        </Button>
        <p role="status" aria-live="polite" className={status?.tone === "error" ? "text-sm font-medium text-danger" : "text-sm text-ink-muted"}>
          {status?.text}
        </p>
        <Link href="/sign-in" className="text-center font-semibold text-brand-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    </>
  );
}
