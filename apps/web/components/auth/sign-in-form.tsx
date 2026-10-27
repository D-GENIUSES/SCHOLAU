"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { type SignInInput, signInSchema } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { safeNext } from "@/lib/utils";
import { authErrorMessage, isEmailNotConfirmed } from "./auth-errors";
import { AuthHeading } from "./auth-heading";
import { authHref, type AuthContext } from "./auth-navigation";

type SignInError = { kind: "unconfirmed"; email: string } | { kind: "message"; message: string };

export function SignInForm({ next, context }: { next?: string; context?: AuthContext }) {
  const router = useRouter();
  const [error, setError] = useState<SignInError | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const form = useForm<SignInInput>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const { error: authError } = await getBrowserSupabase().auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (authError) {
        setError(isEmailNotConfirmed(authError) ? { kind: "unconfirmed", email: values.email } : { kind: "message", message: authErrorMessage(authError) });
        return;
      }
      setRedirecting(true);
      router.replace(safeNext(next, "/auth/continue"));
      router.refresh();
    } catch {
      setRedirecting(false);
      setError({ kind: "message", message: "Sign-in could not be completed. Check your connection and try again." });
    }
  });

  return (
    <>
      <AuthHeading title="Sign in" description="Use the email address linked to your student or lecturer account." />
      <div className="flex flex-col gap-4">
        {error?.kind === "unconfirmed" ? (
          <Alert tone="warning" role="alert" title="Confirm your email first">
            We sent a confirmation link when you signed up.{" "}
            <Link href={`/verify?email=${encodeURIComponent(error.email)}`} className="font-semibold text-brand-primary underline">
              Resend the confirmation email
            </Link>
          </Alert>
        ) : null}
        {error?.kind === "message" ? (
          <Alert tone="error" role="alert">
            {error.message}
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} noValidate className="auth-form">
          <Field id="sign-in-email" label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
          </Field>
          <Field id="sign-in-password" label="Password" error={errors.password?.message}>
            <PasswordInput autoComplete="current-password" {...form.register("password")} />
          </Field>
          <Link href="/recover" className="self-start text-sm font-semibold text-brand-primary underline-offset-4 hover:underline">
            Forgot password?
          </Link>
          <Button type="submit" block loading={isSubmitting || redirecting}>
            Sign in
          </Button>
        </form>

        <p className="text-center text-ink-muted">
          New to ScholAu?{" "}
          <Link href={authHref("/sign-up", context)} className="font-semibold text-brand-primary underline-offset-4 hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </>
  );
}
