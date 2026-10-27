"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { newRequestKey } from "@scholau/api";
import { lecturerApplicationSchema, type LecturerApplication, type LecturerApplicationInput } from "@scholau/core";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { lecturerApi, registrationError } from "@/lib/lecturer-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge, PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";
import { LecturerApplicationFields } from "./lecturer-application-fields";

export const applicationLabels = { pending: "Pending review", changes_requested: "Changes requested", approved: "Approved", rejected: "Rejected" } as const;
export function LecturerApplicationPanel() {
  const [application, setApplication] = useState<LecturerApplication | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const requestKey = useRef<string | null>(null);
  const form = useForm<LecturerApplicationInput>({ resolver: zodResolver(lecturerApplicationSchema) });
  const load = useCallback(async () => {
    try { const result = await lecturerApi(getBrowserSupabase()).mine(); setApplication(result.application); if (result.application) form.reset({ ...result.application, institutional_profile_url: result.application.institutional_profile_url || "" }); }
    catch (e) { setError(registrationError(e)); } finally { setLoading(false); }
  }, [form]);
  useEffect(() => {
    let active = true;
    void lecturerApi(getBrowserSupabase()).mine().then(result => {
      if (!active) return;
      setApplication(result.application);
      if (result.application) form.reset({ ...result.application, institutional_profile_url: result.application.institutional_profile_url || "" });
    }).catch(e => { if (active) setError(registrationError(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [form]);
  useEffect(() => {
    if (!form.formState.isDirty) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, [form.formState.isDirty]);
  const submit = async (data: LecturerApplicationInput) => {
    if (!application) return; setError(null); requestKey.current ??= newRequestKey();
    try { const result = await lecturerApi(getBrowserSupabase()).resubmit(data, application.revision, requestKey.current); setApplication(result.application); form.reset({ ...result.application, institutional_profile_url: result.application.institutional_profile_url || "" }); requestKey.current = null; }
    catch (e) { setError(registrationError(e)); }
  };
  const refresh = () => { setLoading(true); setError(null); void load(); };
  return <div className="lecturer-application-page">
    <PageHeader eyebrow="Lecturer registration" title="Your lecturer application" description="Follow your application and read feedback from the review team." />
    {loading ? <LoadingState label="Loading your application…" /> : null}
    {error ? <Alert tone="error" role="alert" action={<Button onClick={refresh} variant="outline">Refresh application</Button>}>{error}</Alert> : null}
    {!loading && !error && !application ? <Alert title="No lecturer application found">This account has no lecturer application. <Link href="/home" className="font-semibold text-brand-primary">Return to your account</Link>.</Alert> : null}
    {application && !loading ? <div className="application-layout">
      <Card className="application-status"><CardHeader><CardTitle>Application status</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">
        <div><Badge tone={application.status === "approved" ? "success" : application.status === "rejected" ? "danger" : "warning"}>{!application.email_verified ? "Email verification required" : applicationLabels[application.status]}</Badge></div>
        <p className="text-sm text-ink-muted">{application.status === "approved" ? "Your lecturer access is active. Your teaching courses are assigned by an administrator." : application.status === "changes_requested" ? "Update the details below and resubmit your application." : application.status === "rejected" ? "Your application has not been approved. Read the review message below." : "Your details have been received. Your lecturer workspace will become available after administrator approval."}</p>
        {application.applicant_message ? <Alert tone={application.status === "rejected" ? "error" : "info"} title="Message from the review team"><p className="whitespace-pre-wrap">{application.applicant_message}</p></Alert> : null}
        {application.status === "approved" ? <Button asChild><Link href="/lecturer">Open lecturer workspace</Link></Button> : <Button variant="outline" onClick={() => { if (!form.formState.isDirty || window.confirm("Discard your unsaved corrections and refresh?")) refresh(); }}>Refresh status</Button>}
      </CardContent></Card>
      <Card className="application-details"><CardHeader><CardTitle>Your submitted details</CardTitle></CardHeader><CardContent>
        {application.status === "changes_requested" ? <FormProvider {...form}><form noValidate onSubmit={event => { void form.handleSubmit(submit)(event); }} className="flex flex-col gap-4"><LecturerApplicationFields key={`${application.id}-${application.revision}`} /><Button type="submit" loading={form.formState.isSubmitting}>Resubmit application</Button></form></FormProvider> : <dl className="grid gap-4 sm:grid-cols-2">{([['Full name',application.full_name],['Email',application.email],['University',application.university],['Faculty',application.faculty],['Department',application.department],['Teaching position',application.position],['Requested courses',application.requested_courses],['Institutional profile',application.institutional_profile_url||'Not provided'],['Verification information',application.verification_note||'Not provided']] as const).map(([k,v])=><div key={k}><dt className="text-sm text-ink-muted">{k}</dt><dd className="break-words whitespace-pre-wrap font-medium">{v}</dd></div>)}</dl>}
      </CardContent></Card>
      {application.history?.length ? <Card className="application-history"><CardHeader><CardTitle>Application history</CardTitle></CardHeader><CardContent><ol className="space-y-4">{application.history.map((h,i)=><li key={i} className="border-t border-line pt-3"><p className="font-semibold">{h.action.replaceAll('_',' ')}</p><p className="text-sm text-ink-muted">{new Date(h.created_at).toLocaleString('en-GB',{timeZone:'Africa/Lagos'})} WAT</p>{h.applicant_message ? <p className="mt-1 whitespace-pre-wrap text-sm">{h.applicant_message}</p> : null}</li>)}</ol></CardContent></Card> : null}
    </div> : null}
  </div>;
}
