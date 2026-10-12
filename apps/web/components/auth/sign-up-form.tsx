"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { type SignUpInput, signUpSchema } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { useAnalytics } from "@/lib/analytics";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { authErrorMessage } from "./auth-errors";
import { AuthHeading } from "./auth-heading";
import { CheckboxField } from "./checkbox-field";

export function SignUpForm() {
  const router = useRouter();
  const analytics = useAnalytics();
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "", adultConfirmed: false },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const { data, error: authError } = await getBrowserSupabase().auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { display_name: values.displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    if (authError) {
      setError(authErrorMessage(authError));
      return;
    }
    analytics.track({ name: "signup_completed" });
    setRedirecting(true);
    if (data.session) {
      router.replace("/onboarding");
      router.refresh();
    } else {
      router.replace(`/verify?email=${encodeURIComponent(values.email)}`);
    }
  });

  return (
    <>
      <AuthHeading title="Create your account" description="Study your courses, practise, and battle classmates." />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error ? (
          <Alert tone="error" role="alert">
            {error}
          </Alert>
        ) : null}
        <Field id="sign-up-name" label="Display name" hint="Shown on leaderboards and in battles." error={errors.displayName?.message}>
          <Input autoComplete="nickname" maxLength={60} {...form.register("displayName")} />
        </Field>
        <Field id="sign-up-email" label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
        </Field>
        <Field id="sign-up-password" label="Password" hint="At least 8 characters." error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...form.register("password")} />
        </Field>
        <CheckboxField
          id="sign-up-adult"
          label="I'm a university student aged 18 or over."
          error={errors.adultConfirmed?.message}
          {...form.register("adultConfirmed")}
        />
        <p className="text-sm text-ink-muted">
          By creating an account you agree to how we handle your data in our{" "}
          <Link href="/privacy" className="font-semibold text-brand-primary underline">
            privacy summary
          </Link>
          .
        </p>
        <Button type="submit" block loading={isSubmitting || redirecting}>
          Create account
        </Button>
        <p className="text-center text-ink-muted">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-brand-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </>
  );
}
