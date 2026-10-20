"use client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { registrationLegalError, registrationLegalMetadata, type AgeDeclaration, type RegistrationLegalStatus } from "@/lib/legal";

export function useRegistrationLegal() {
  const [age, setAge] = useState<AgeDeclaration>("");
  const [accepted, setAccepted] = useState(false);
  const [approval, setApproval] = useState("");
  const [status, setStatus] = useState<RegistrationLegalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void getBrowserSupabase().rpc("get_registration_legal_status_v1").then(({ data, error }) => {
      if (active) { setStatus(error ? null : data as RegistrationLegalStatus); setLoading(false); }
    }, () => { if (active) { setStatus(null); setLoading(false); } });
    return () => { active = false; };
  }, []);
  return { age, setAge, accepted, setAccepted, approval, setApproval, status, loading,
    validate: () => registrationLegalError(age, accepted, approval, status), metadata: () => registrationLegalMetadata(age, approval) };
}
export function RegistrationLegal({ legal, showTerms = true, pending = false }: { legal: ReturnType<typeof useRegistrationLegal>; showTerms?: boolean; pending?: boolean }) {
  const id = useId();
  return <div className="registration-legal flex flex-col gap-4">
    <fieldset className="flex flex-col gap-2" aria-describedby={`${id}-age-note`}>
      <legend className="mb-2 font-semibold">Your age group</legend>
      <label className="flex min-h-11 cursor-pointer items-center gap-3"><input type="radio" name={`${id}-age`} checked={legal.age === "adult"} onChange={() => legal.setAge("adult")} />I am 18 or older</label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3"><input type="radio" name={`${id}-age`} checked={legal.age === "under18"} onChange={() => legal.setAge("under18")} />I am under 18</label>
      <p id={`${id}-age-note`} className="text-sm text-ink-muted">University entrants under 18 need verified parent or guardian consent before {pending ? "registration can be completed" : "an account can be created"}.</p>
    </fieldset>
    {legal.age === "under18" ? <div className="rounded-control border border-line p-4" role="status">
      {legal.status?.guardian_enabled ? <><p>Ask your parent or guardian to contact <a className="underline" href={`mailto:${legal.status.support_email}`}>{legal.status.support_email}</a>. Support must verify their authority and consent before issuing your approval code. Do not send identity documents or passwords through this form.</p><label htmlFor={`${id}-approval`} className="mt-3 block font-semibold">Guardian approval code</label><input id={`${id}-approval`} className="mt-2 w-full rounded-control border border-line p-3" autoComplete="off" maxLength={36} value={legal.approval} onChange={event => legal.setApproval(event.target.value)} /></> : <p>Registration for students under 18 is not open yet. We are preparing guardian verification and support contacts. {pending ? "Your registration remains incomplete." : "No account will be created."}</p>}
    </div> : null}
    {showTerms ? <><label className="flex min-h-11 items-start gap-3"><input className="mt-1" type="checkbox" checked={legal.accepted} onChange={event => legal.setAccepted(event.target.checked)} /><span>I have read and accept the <Link className="font-semibold underline" href="/terms" target="_blank" rel="noopener">Terms of Use (draft; opens in a new tab)</Link>.</span></label><p className="text-sm text-ink-muted">Read our <Link className="font-semibold underline" href="/privacy" target="_blank" rel="noopener">Privacy Policy (draft; opens in a new tab)</Link> to understand how we handle your data. Optional notifications are offered separately.</p></> : null}
    {legal.loading ? <p role="status" className="text-sm">Checking registration availability…</p> : !legal.status ? <p role="alert" className="text-sm">Registration is temporarily unavailable while we update our policies. Please try again later.</p> : null}
  </div>;
}
