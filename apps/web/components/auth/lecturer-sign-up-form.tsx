"use client";
import Link from "next/link";
import { Fragment, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { lecturerSignUpSchema, type LecturerSignUpInput } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { lecturerApi } from "@/lib/lecturer-api";
import { AuthSteps } from "./auth-steps";
import { SignupNotifications } from "@/components/notifications/signup-notifications";
import { AuthHeading } from "./auth-heading";
import { authErrorMessage } from "./auth-errors";
import { LecturerApplicationFields } from "./lecturer-application-fields";
import { RegistrationLegal, useRegistrationLegal } from "./registration-legal";

export function LecturerSignUpForm() {
  const legal = useRegistrationLegal();
  const [step, setStep] = useState<0 | 1>(0);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<{ owner: string | null; destination: string; hasSession: boolean } | null>(null);
  const form = useForm<LecturerSignUpInput>({ resolver: zodResolver(lecturerSignUpSchema), defaultValues: { full_name: "", email: "", password: "", university: "", faculty: "", department: "", position: "", requested_courses: "", institutional_profile_url: "", verification_note: "" } });
  const submit = form.handleSubmit(async values => {
    setError(null);
    const legalError = legal.validate();
    if (legalError) { setError(legalError); setStep(0); return; }
    try {
      const client = getBrowserSupabase();
      // Fail closed while the database migration is absent. Never accidentally create a student.
      const ready = await lecturerApi(client).capabilities();
      if (!ready.lecturer_applications) throw Error("not-ready");
      const { email, password, ...application } = values;
      const { data, error: authError } = await client.auth.signUp({ email, password, options: { data: { display_name: values.full_name.slice(0, 60), signup_kind: "lecturer", lecturer_application: application, ...legal.metadata() }, emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/continue` } });
      if (authError) { setError(authErrorMessage(authError)); return; }
      setCompletion({ owner: data.user?.id ?? null, hasSession: Boolean(data.session), destination: data.session ? "/lecturer/application" : `/verify?kind=lecturer&email=${encodeURIComponent(email)}` });
    } catch { setError("Lecturer applications are temporarily unavailable. Please try again later. You have not been registered as a student."); }
  });
  if (completion) return <SignupNotifications {...completion} />;

  return <>
    <Link href="/sign-up" className="auth-options-back">← Account options</Link>
    <AuthSteps current={step} labels={["Account", "Teaching details"]} />
    <AuthHeading title={step === 0 ? "Apply as a lecturer" : "Your teaching details"} description={step === 0 ? "Create your sign-in details, then tell us about your teaching role." : "An administrator will review your affiliation and requested courses."} />
    
    <FormProvider {...form}><form noValidate className="auth-form" onSubmit={event => {
      if (step === 0) { event.preventDefault(); const legalError = legal.validate(); if (legalError) { setError(legalError); return; } setError(null); void form.trigger(["email", "password"], { shouldFocus: true }).then(valid => { if (valid) setStep(1); }); }
      else void submit(event);
    }}>
      {error ? <Alert tone="error" role="alert">{error}</Alert> : null}
      {step === 0 ? <Fragment key="account">
      <Field id="lecturer-email" label="Email" hint="An institutional email is recommended. Use an address you can confirm." error={form.formState.errors.email?.message}><Input type="email" autoComplete="email" {...form.register("email")} /></Field>
      <Field id="lecturer-password" label="Password" hint="At least 8 characters." error={form.formState.errors.password?.message}><PasswordInput autoComplete="new-password" {...form.register("password")} /></Field>
      <p className="auth-form-note">After submission, confirm your email and wait for administrator approval. Confirming your email does not grant lecturer access.</p>
      <RegistrationLegal legal={legal} />
      <Button block type="submit" disabled={legal.loading}>Continue</Button>
      </Fragment> : null}
      <div hidden={step !== 1}>
      <LecturerApplicationFields />
      <div className="mt-4 grid gap-3">
      <p className="text-sm text-ink-muted">Your acceptance of the <Link href="/terms" className="underline">Terms of Use</Link> applies to this application. Read the <Link href="/privacy" className="underline">Privacy Policy</Link>. Administrators review your details.</p>
      <Button block type="submit" loading={form.formState.isSubmitting}>Submit lecturer application</Button>
      <Button type="button" variant="ghost" disabled={form.formState.isSubmitting} onClick={() => { setError(null); setStep(0); }}>Back to account details</Button>
      </div>
      </div>
      <p className="text-center text-sm">Already applied? <Link href="/sign-in" className="text-brand-primary underline">Sign in to check your application</Link></p>
    </form></FormProvider>
  </>;
}
