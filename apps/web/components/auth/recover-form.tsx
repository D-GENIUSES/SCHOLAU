"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { type RecoverInput, recoverSchema } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AuthHeading } from "./auth-heading";

export function RecoverForm() {
  const [sent, setSent] = useState(false);
  const form = useForm<RecoverInput>({ resolver: zodResolver(recoverSchema), defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    // The outcome is never revealed, so the form can't be used to discover registered emails.
    await getBrowserSupabase()
      .auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` })
      .catch(() => undefined);
    setSent(true);
  });

  return (
    <>
      <AuthHeading title="Reset your password" description="Enter your email and we'll send you a link to choose a new password." />
      {sent ? (
        <div className="flex flex-col gap-4">
          <Alert tone="success" role="status" title="Check your email">
            If an account exists for that email, we&apos;ve sent a reset link. It may take a few minutes to arrive.
          </Alert>
          <Button variant="outline" block onClick={() => setSent(false)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field id="recover-email" label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
          </Field>
          <Button type="submit" block loading={isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-4 text-center">
        <Link href="/sign-in" className="font-semibold text-brand-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
