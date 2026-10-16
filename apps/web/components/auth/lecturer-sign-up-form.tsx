"use client";
import Link from "next/link";
import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { lecturerSignUpSchema, type LecturerSignUpInput } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { lecturerApi } from "@/lib/lecturer-api";
import { AuthSteps } from "./auth-steps";
import { AuthHeading } from "./auth-heading";
import { authErrorMessage } from "./auth-errors";
import { LecturerApplicationFields } from "./lecturer-application-fields";

export function LecturerSignUpForm() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const form = useForm<LecturerSignUpInput>({ resolver: zodResolver(lecturerSignUpSchema), defaultValues: { full_name: "", email: "", password: "", university: "", faculty: "", department: "", position: "", requested_courses: "", institutional_profile_url: "", verification_note: "" } });
  const submit = form.handleSubmit(async values => {
    setError(null);
    try {
      const client = getBrowserSupabase();
      // Fail closed while the database migration is absent. Never accidentally create a student.
      const ready = await lecturerApi(client).capabilities();
      if (!ready.lecturer_applications) throw Error("not-ready");
      const { email, password, ...application } = values;
      const { data, error: authError } = await client.auth.signUp({ email, password, options: { data: { display_name: values.full_name.slice(0, 60), signup_kind: "lecturer", lecturer_application: application }, emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/continue` } });
      if (authError) { setError(authErrorMessage(authError)); return; }
      setRedirecting(true);
      router.replace(data.session ? "/lecturer/application" : `/verify?kind=lecturer&email=${encodeURIComponent(email)}`);
      router.refresh();
    } catch { setError("Lecturer applications are temporarily unavailable. Please try again later. You have not been registered as a student."); }
  });
  return <>
    <Link href="/sign-up" className="auth-options-back">← Account options</Link>
    <AuthSteps current={step} labels={["Account", "Teaching details"]} />
    <AuthHeading title={step === 0 ? "Apply as a lecturer" : "Your teaching details"} description={step === 0 ? "Create your sign-in details, then tell us about your teaching role." : "An administrator will review your affiliation and requested courses."} />
    
    <form noValidate className="auth-form" onSubmit={event => {
      if (step === 0) { event.preventDefault(); void form.trigger(["email", "password"], { shouldFocus: true }).then(valid => { if (valid) setStep(1); }); }
      else void submit(event);
    }}>
      {error ? <Alert tone="error" role="alert">{error}</Alert> : null}
      {step === 0 ? <Fragment key="account">
      <Field id="lecturer-email" label="Email" hint="An institutional email is recommended. Use an address you can confirm." error={form.formState.errors.email?.message}><Input type="email" autoComplete="email" {...form.register("email")} /></Field>
      <Field id="lecturer-password" label="Password" hint="At least 8 characters." error={form.formState.errors.password?.message}><PasswordInput autoComplete="new-password" {...form.register("password")} /></Field>
      <p className="auth-form-note">After submission, confirm your email and wait for administrator approval. Confirming your email does not grant lecturer access.</p>
      <Button block type="submit">Continue</Button>
      </Fragment> : <Fragment key="teaching">
      <LecturerApplicationFields register={form.register} errors={form.formState.errors} />
      <p className="text-sm text-ink-muted">By applying, you acknowledge our <Link href="/privacy" className="font-semibold text-brand-primary underline">privacy summary</Link>. Your details are shared with administrators for review.</p>
      <Button block type="submit" loading={form.formState.isSubmitting || redirecting}>Submit lecturer application</Button>
      <Button type="button" variant="ghost" disabled={form.formState.isSubmitting || redirecting} onClick={() => { setError(null); setStep(0); }}>Back to account details</Button>
      </Fragment>}
      <p className="text-center text-sm">Already applied? <Link href="/sign-in" className="text-brand-primary underline">Sign in to check your application</Link></p>
    </form>
  </>;
}
