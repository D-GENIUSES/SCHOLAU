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

export function ResetPasswordForm({ changing = false }: { changing?: boolean }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
    let authError;
    try { ({ error: authError } = await getBrowserSupabase().auth.updateUser({ password })); }
    catch { setError("Your password could not be saved. Please try again."); return; }
    if (authError) {
      setError(authErrorMessage(authError));
      return;
    }
    form.reset();
    setSaved(true);
    router.refresh();
  });

  if (session === "checking") {
    return (
      <>
        <AuthHeading title={changing ? "Change password" : "Choose a new password"} />
        <Spinner label={changing ? "Checking your session..." : "Checking your reset link..."} />
      </>
    );
  }

  if (session === "none") {
    return (
      <>
        <AuthHeading title={changing ? "Change password" : "Choose a new password"} />
        <Alert tone="warning" role="alert" title={changing ? "Your session has expired" : "Your reset link is invalid or has expired"}>
          {changing ? "Sign in again to change your password." : "Request a new link and open it on this device."}
        </Alert>
        <Button asChild block className="mt-4">
          <Link href={changing ? "/sign-in?next=%2Fchange-password" : "/recover"}>{changing ? "Sign in" : "Request a new link"}</Link>
        </Button>
      </>
    );
  }

  if (saved) return <><AuthHeading title="Password updated" /><Alert tone="success" role="status">Your new password is ready to use the next time you sign in.</Alert><Button asChild block className="mt-4"><Link href="/auth/continue">Continue to your account</Link></Button></>;

  return (
    <>
      <AuthHeading title={changing ? "Change password" : "Choose a new password"} description="Use at least 8 characters." />
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
        <Button type="submit" block loading={isSubmitting}>
          Save new password
        </Button>
      </form>
    </>
  );
}
