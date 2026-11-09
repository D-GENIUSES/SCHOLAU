"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { lecturerApplicationSchema, type LecturerApplicationInput } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AuthHeading } from "./auth-heading";
import { LecturerApplicationFields } from "./lecturer-application-fields";
import { RegistrationLegal, useRegistrationLegal } from "./registration-legal";
import { SignOutButton } from "./sign-out-button";

export function GoogleLecturerApplicationForm({ email, name }: { email: string; name: string }) {
  const legal = useRegistrationLegal();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LecturerApplicationInput>({
    resolver: zodResolver(lecturerApplicationSchema),
    defaultValues: {
      full_name: name, university: "", faculty: "", department: "", position: "",
      requested_courses: "", institutional_profile_url: "", verification_note: "",
    },
  });
  const submit = form.handleSubmit(async (application) => {
    const legalError = legal.validate();
    setError(legalError);
    if (legalError) return;
    try {
      const { data, error: rpcError } = await getBrowserSupabase().rpc("complete_google_lecturer_registration_v1", {
        p_application: application,
        p_metadata: legal.metadata(),
      });
      if (rpcError || !data?.application_id) {
        setError("We couldn’t submit your application. Check your details and try again.");
        return;
      }
      queryClient.clear();
      window.location.replace("/lecturer/application");
    } catch {
      setError("Your connection was interrupted. Please try again.");
    }
  });
  return (
    <>
      <AuthHeading title="Your teaching details" description="An administrator will review your affiliation and requested courses." />
      <p className="mb-4 wrap-break-word text-sm text-ink-muted">Google account <span className="font-semibold text-ink">{email}</span></p>
      <FormProvider {...form}>
        <form className="auth-form" onSubmit={submit} noValidate>
          {error ? <Alert tone="error" role="alert">{error}</Alert> : null}
          <LecturerApplicationFields />
          <RegistrationLegal legal={legal} />
          <Button block type="submit" disabled={legal.loading} loading={form.formState.isSubmitting}>Submit lecturer application</Button>
        </form>
      </FormProvider>
      <div className="mt-4"><SignOutButton /></div>
    </>
  );
}
