"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { type SignUpInput, signUpSchema, registrationAcademicMetadata, SEMESTER_LABELS } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, PasswordInput } from "@/components/ui/input";
import { useAnalytics } from "@/lib/analytics";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { authErrorMessage } from "./auth-errors";
import { AuthHeading } from "./auth-heading";
import { AuthSteps } from "./auth-steps";
import { SignupNotifications } from "@/components/notifications/signup-notifications";
import { UniversitySelect } from "./university-select";

export function SignUpForm() {
  const analytics = useAnalytics();
  const [step, setStep] = useState<"account" | "studies">("account");
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<{ owner: string | null; destination: string; hasSession: boolean } | null>(null);
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "", universitySlug: "", faculty: "", department: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const nextStep = async () => {
    if (await form.trigger(["displayName", "email", "password"], { shouldFocus: true })) setStep("studies");
  };

  const createAccount = form.handleSubmit(async (values) => {
    setError(null);
    const { data, error: authError } = await getBrowserSupabase().auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { display_name: values.displayName, ...registrationAcademicMetadata(values) },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/home`,
      },
    });
    if (authError) { setError(authErrorMessage(authError)); return; }
    analytics.track({ name: "signup_completed" });
    setCompletion({ owner: data.user?.id ?? null, hasSession: Boolean(data.session), destination: data.session ? "/home" : `/verify?email=${encodeURIComponent(values.email)}` });
  });

  if (completion) return <SignupNotifications {...completion} />;

  return <>
    <AuthSteps current={step === "account" ? 0 : 1} labels={["Account", "Study details"]} />
    <AuthHeading title={step === "account" ? "Create your account" : "Your study details"}
      description={step === "account" ? "Enter your name, email, and a password." : "We use these details to find your course assignments."} />
    <form noValidate className="auth-form" onSubmit={(event) => {
      if (step === "account") { event.preventDefault(); void nextStep(); }
      else void createAccount(event);
    }}>
      {error ? <Alert tone="error" role="alert">{error}</Alert> : null}
      {step === "account" ? <>
        <Field id="sign-up-name" label="Display name" hint="Use your name or a nickname, not your email. Shown on leaderboards and to battle opponents." error={errors.displayName?.message}>
          <Input autoComplete="nickname" maxLength={60} {...form.register("displayName")} />
        </Field>
        <Field id="sign-up-email" label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
        </Field>
        <Field id="sign-up-password" label="Password" hint="At least 8 characters." error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...form.register("password")} />
        </Field>
        
        <Button type="submit" block>Continue</Button>
      </> : <>
        <Controller control={form.control} name="universitySlug" render={({ field }) =>
          <UniversitySelect value={field.value} onChange={field.onChange} onBlur={field.onBlur} inputRef={field.ref} error={errors.universitySlug?.message} />
        } />
        <Field id="sign-up-faculty" label="Faculty" error={errors.faculty?.message}>
          <Input autoComplete="off" placeholder="Enter your faculty" maxLength={200} {...form.register("faculty")} />
        </Field>
        <Field id="sign-up-department" label="Department" error={errors.department?.message}>
          <Input autoComplete="off" placeholder="Enter your department" maxLength={200} {...form.register("department")} />
        </Field>
        <Field id="sign-up-semester" label="Current semester" error={errors.currentSemester?.message}>
          <NativeSelect defaultValue="" {...form.register("currentSemester")}>
            <option value="" disabled>Select your semester</option>
            {Object.entries(SEMESTER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </NativeSelect>
        </Field>
        <p className="text-xs leading-relaxed text-ink-muted">By creating an account, you acknowledge our <Link href="/privacy" className="font-semibold text-brand-primary underline">privacy summary</Link>.</p>
        <Button type="submit" block loading={isSubmitting}>Create account</Button>
        <Button type="button" variant="ghost" disabled={isSubmitting} onClick={() => { setError(null); setStep("account"); }}>Back</Button>
      </>}
      <p className="text-center text-sm text-ink-muted">Already have an account? <Link href="/sign-in" className="font-semibold text-brand-primary underline-offset-4 hover:underline">Sign in</Link></p>
    </form>
  </>;
}
