"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { type SignUpInput, signUpSchema, registrationAcademicMetadata } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { useAnalytics } from "@/lib/analytics";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { authErrorMessage } from "./auth-errors";
import { AuthHeading } from "./auth-heading";
import { AuthSteps } from "./auth-steps";
import { SignupNotifications } from "@/components/notifications/signup-notifications";
import { UniversitySelect } from "./university-select";
import { RegistrationStudyFields } from "./registration-study-fields";
import { suggestUsernames, UsernameSuggestions } from "./username-suggestions";
import { RegistrationLegal, useRegistrationLegal } from "./registration-legal";
import { authHref, type AuthContext } from "./auth-navigation";
import { safeNext } from "@/lib/utils";

export function SignUpForm({ next, context }: { next?: string; context?: AuthContext }) {
  const legal = useRegistrationLegal();
  const analytics = useAnalytics();
  const [step, setStep] = useState<"account" | "studies">("account");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [completion, setCompletion] = useState<{ owner: string | null; destination: string; hasSession: boolean } | null>(null);
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { username: "", email: "", password: "", universitySlug: "", faculty: "", department: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const nextStep = async () => {
    const legalError = legal.validate();
    if (legalError) { setError(legalError); return; }
    setError(null);
    if (await form.trigger(["username", "email", "password"], { shouldFocus: true })) setStep("studies");
  };

  const createAccount = form.handleSubmit(async (values) => {
    setError(null);
    const legalError = legal.validate();
    if (legalError) { setError(legalError); setStep("account"); return; }
    try {
    const { data: available, error: availabilityError } = await getBrowserSupabase().rpc("is_username_available_v1", { p_username: values.username });
    if (availabilityError) { setError("Could not check your username. Please try again."); return; }
    if (!available) {
      form.setError("username", { message: "That username already exists. Choose another." });
      setSuggestions(await suggestUsernames(values.username));
      setStep("account");
      return;
    }
    const destination = values.department.trim().toLowerCase() === "law" ? "/onboarding/courses" : safeNext(next, "/home");
    const { data, error: authError } = await getBrowserSupabase().auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { username: values.username, display_name: values.username, ...registrationAcademicMetadata(values), ...legal.metadata() },
        emailRedirectTo: `${window.location.origin}/auth/callback?${new URLSearchParams({ next: destination })}`,
      },
    });
    if (authError) {
      const check = await getBrowserSupabase().rpc("is_username_available_v1", { p_username: values.username });
      if (check.data === false) {
        form.setError("username", { message: "That username already exists. Choose another." });
        setSuggestions(await suggestUsernames(values.username));
        setStep("account");
      } else setError(authErrorMessage(authError));
      return;
    }
    analytics.track({ name: "signup_completed" });
    setCompletion({ owner: data.user?.id ?? null, hasSession: Boolean(data.session), destination: data.session ? destination : `/verify?email=${encodeURIComponent(values.email)}` });
    } catch {
      setError("Registration could not be confirmed. Check your email or try signing in before retrying.");
    }
  });

  if (completion) return <SignupNotifications {...completion} />;

  return <>
    <AuthSteps current={step === "account" ? 0 : 1} labels={["Account", "Study details"]} />
    <AuthHeading title={step === "account" ? "Create your account" : "Your study details"}
      description={step === "account" ? "Choose a username, then enter your email and a password." : "We use these details to find your course assignments."} />
    <form noValidate className="auth-form" onSubmit={(event) => {
      if (step === "account") { event.preventDefault(); void nextStep(); }
      else void createAccount(event);
    }}>
      {error ? <Alert tone="error" role="alert">{error}</Alert> : null}
      {step === "account" ? <>
        <Field id="sign-up-name" label="Username" hint="Your unique name for battles, rankings and friends. Use 3–24 letters, numbers or underscores." error={errors.username?.message}>
          <Input autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={24} {...form.register("username")} />
        </Field>
        <UsernameSuggestions names={suggestions} onChoose={(name) => {
          form.setValue("username", name, { shouldDirty: true, shouldValidate: true });
          form.clearErrors("username");
          setSuggestions([]);
        }} />
        <Field id="sign-up-email" label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
        </Field>
        <Field id="sign-up-password" label="Password" hint="At least 8 characters." error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...form.register("password")} />
        </Field>
        
        <RegistrationLegal legal={legal} />
        <Button type="submit" block disabled={legal.loading}>Continue</Button>
      </> : <>
        <Controller control={form.control} name="universitySlug" render={({ field }) =>
          <UniversitySelect value={field.value} onChange={value => {
            field.onChange(value); form.setValue("faculty", ""); form.setValue("department", ""); form.setValue("catalogProfile", undefined);
          }} onBlur={field.onBlur} inputRef={field.ref} error={errors.universitySlug?.message} />
        } />
        <RegistrationStudyFields form={form} />
        <p className="text-xs leading-relaxed text-ink-muted">Your acceptance of the <Link href="/terms" className="underline">Terms of Use</Link> applies to this registration. <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
        <Button type="submit" block loading={isSubmitting}>Create account</Button>
        <Button type="button" variant="ghost" disabled={isSubmitting} onClick={() => { setError(null); setStep("account"); }}>Back</Button>
      </>}
      <p className="text-center text-sm text-ink-muted">Already have an account? <Link href={authHref("/sign-in", context)} className="font-semibold text-brand-primary underline-offset-4 hover:underline">Sign in</Link></p>
    </form>
  </>;
}
