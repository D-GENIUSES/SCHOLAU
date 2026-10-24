"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { registrationLegalError, registrationLegalMetadata, type RegistrationLegalStatus } from "@/lib/legal";

export function useRegistrationLegal() {
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<RegistrationLegalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void getBrowserSupabase().rpc("get_registration_legal_status_v1").then(({ data, error }) => {
      if (active) { setStatus(error ? null : data as RegistrationLegalStatus); setLoading(false); }
    }, () => { if (active) { setStatus(null); setLoading(false); } });
    return () => { active = false; };
  }, []);
  return {
    accepted,
    setAccepted,
    status,
    loading,
    validate: () => registrationLegalError(accepted, status),
    metadata: () => registrationLegalMetadata(),
  };
}

export function RegistrationLegal({ legal, showTerms = true }: { legal: ReturnType<typeof useRegistrationLegal>; showTerms?: boolean; pending?: boolean }) {
  return (
    <div className="registration-legal flex flex-col gap-4">
      {showTerms ? (
        <>
          <label className="flex min-h-11 items-start gap-3">
            <input className="mt-1" type="checkbox" checked={legal.accepted} onChange={(event) => legal.setAccepted(event.target.checked)} />
            <span>
              I have read and accept the{" "}
              <Link className="font-semibold underline" href="/terms" target="_blank" rel="noopener">
                Terms of Use (draft; opens in a new tab)
              </Link>
              .
            </span>
          </label>
          <p className="text-sm text-ink-muted">
            Read our{" "}
            <Link className="font-semibold underline" href="/privacy" target="_blank" rel="noopener">
              Privacy Policy (draft; opens in a new tab)
            </Link>{" "}
            to understand how we handle your data. Optional notifications are offered separately.
          </p>
        </>
      ) : null}
      {legal.loading ? (
        <p role="status" className="text-sm">
          Checking registration availability…
        </p>
      ) : !legal.status ? (
        <p role="alert" className="text-sm">
          Registration is temporarily unavailable while we update our policies. Please try again later.
        </p>
      ) : null}
    </div>
  );
}
