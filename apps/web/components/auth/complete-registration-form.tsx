"use client";

import { type FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AuthHeading } from "./auth-heading";
import { RegistrationLegal, useRegistrationLegal } from "./registration-legal";
import { SignOutButton } from "./sign-out-button";

export function CompleteRegistrationForm() {
  const legal = useRegistrationLegal();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const validation = legal.validate();
    if (validation) { setError(validation); return; }
    setError(null);
    setSaving(true);
    try {
      const result = await getBrowserSupabase().rpc("complete_registration_v1", { p_metadata: legal.metadata() });
      if (result.error || result.data?.completed !== true) {
        setError("Registration could not be completed. Check your details and try again.");
        return;
      }
      queryClient.clear();
      window.location.replace("/auth/continue");
    } catch {
      setError("Your connection was interrupted. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  return <>
    <AuthHeading title="Complete your registration" description="Confirm these details once to open your ScholAu account." />
    <form onSubmit={event => void complete(event)} className="auth-form">
      {error ? <Alert tone="error" role="alert">{error}</Alert> : null}
      <RegistrationLegal legal={legal} pending />
      <Button type="submit" block loading={saving} disabled={legal.loading}>Accept and continue</Button>
    </form>
    <div className="mt-4"><SignOutButton /></div>
  </>;
}
