"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { type ResetPasswordInput, resetPasswordSchema } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/input";
import { Spinner } from "@/components/ui/states";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { authErrorMessage } from "./auth-errors";
import { AuthHeading } from "./auth-heading";

type SessionStatus = "checking" | "none" | "ready";

export function ResetPasswordForm() {
  const router = useRouter();
  const [session, setSession] = useState<SessionStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const form = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirm: "" } });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setSession((s) => (s === "ready" ? s : data.user ? "ready" : "none"));
      })
      .catch(() => {
        if (active) setSession((s) => (s === "ready" ? s : "none"));
      });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      if (active && s) setSession("ready");
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    const { error: authError } = await getBrowserSupabase().auth.updateUser({ password });
    if (authError) {
      setError(authErrorMessage(authError));
      return;
    }
    setRedirecting(true);
    router.replace("/home");
    router.refresh();
  });

  if (session === "checking") {
    return (
      <>
        <AuthHeading title="Choose a new password" />
        <Spinner label="Checking your reset link…" />
      </>
    );
  }

  if (session === "none") {
    return (
      <>
        <AuthHeading title="Choose a new password" />
        <Alert tone="warning" role="alert" title="Your reset link is invalid or has expired">
          Request a new link and open it on this device.
        </Alert>
        <Button asChild block className="mt-4">
          <Link href="/recover">Request a new link</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Choose a new password" description="Use at least 8 characters." />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error ? (
          <Alert tone="error" role="alert">
            {error}
          </Alert>
        ) : null}
        <Field id="reset-password" label="New password" error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...form.register("password")} />
        </Field>
        <Field id="reset-confirm" label="Confirm new password" error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
        </Field>
        <Button type="submit" block loading={isSubmitting || redirecting}>
          Save new password
        </Button>
      </form>
    </>
  );
}
