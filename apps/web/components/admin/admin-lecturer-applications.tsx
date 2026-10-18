"use client";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { newRequestKey } from "@scholau/api";
import type { LecturerApplication, LecturerApplicationStatus, LecturerOffering } from "@scholau/core";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { lecturerApi, registrationError } from "@/lib/lecturer-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Badge, PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { DataTable } from "@/components/admin/data-table";

const labels = { pending: "Pending review", changes_requested: "Changes requested", approved: "Approved", rejected: "Rejected" };
export function AdminLecturerApplications() {
  const [status,setStatus]=useState<LecturerApplicationStatus|"">("pending"),[search,setSearch]=useState(""),[query,setQuery]=useState(""),[page,setPage]=useState(0);
  const [selected,setSelected]=useState<LecturerApplication|null>(null),[offerings,setOfferings]=useState<LecturerOffering[]>([]),[offeringIds,setOfferingIds]=useState<string[]>([]),[offeringSearch,setOfferingSearch]=useState("");
  const [busy,setBusy]=useState(false),[detailLoading,setDetailLoading]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
  const [decision,setDecision]=useState<Exclude<LecturerApplicationStatus,'pending'>>('approved'),[message,setMessage]=useState(''),[note,setNote]=useState('');
  const requestKey=useRef<string|null>(null), detailGeneration=useRef(0);
  const applications = useQuery({
    queryKey: ["admin", "lecturer-applications", status, query, page],
    queryFn: () => lecturerApi(getBrowserSupabase()).list(status || null, query, page * 20),
    retry: false,
    staleTime: 0,
  });
  const items = applications.data?.items ?? [];
  const total = applications.data?.total ?? 0;
  const pending = applications.data?.pending_count ?? 0;
  const loading = applications.isFetching;
  const displayError = error ?? (applications.isError ? registrationError(applications.error) : null);
  const load = () => applications.refetch();
  const open=async(id:string)=>{const gen=++detailGeneration.current;setDetailLoading(true);setSelected(null);setError(null);setNotice(null);try{const api=lecturerApi(getBrowserSupabase());const [r,o]=await Promise.all([api.detail(id),api.offerings()]);if(gen!==detailGeneration.current)return;setSelected(r.application);setOfferings(o.items);setOfferingIds(r.application.assigned_offering_ids);setDecision('approved');setMessage('');setNote('');requestKey.current=null}catch(e){if(gen===detailGeneration.current)setError(registrationError(e))}finally{if(gen===detailGeneration.current)setDetailLoading(false)}};
  const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!selected||busy)return;if(selected.status==='pending'&&decision==='approved'&&!selected.email_verified){setError('The applicant must verify their email before approval.');return}if(!window.confirm(selected.status==='approved'?'Save these course assignments?':decision==='approved'?'Approve this application and activate lecturer access?':`Send this ${decision==='rejected'?'rejection':'request for changes'} to the applicant?`))return;setBusy(true);setError(null);requestKey.current??=newRequestKey();try{const api=lecturerApi(getBrowserSupabase());const r=selected.status==='approved'?await api.assign(selected.id,offeringIds,selected.revision,requestKey.current):await api.review({id:selected.id,decision,message,internalNote:note,offeringIds,revision:selected.revision,requestKey:requestKey.current});setSelected(r.application);setNotice('Application saved. The applicant sees the updated status when they sign in or refresh.');requestKey.current=null;await load()}catch(e){setError(registrationError(e))}finally{setBusy(false)}};
  return <>
    <PageHeader eyebrow="People & access" title="Lecturer applications" description={`${pending} pending · Review teaching affiliations before activating lecturer access.`} />
    {displayError?<Alert tone="error" role="alert" action={<Button variant="outline" onClick={()=>{void load();if(selected)void open(selected.id)}}>Refresh</Button>}>{displayError}</Alert>:null}
    {notice?<Alert tone="success" role="status">{notice}</Alert>:null}
    <form className="my-5 flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();setQuery(search.trim());setPage(0);setSelected(null)}}>
      <Field id="application-search" label="Search applicants"><Input value={search} maxLength={200} onChange={e=>setSearch(e.target.value)} placeholder="Name, email or university" /></Field>
      <Field id="application-status" label="Status"><NativeSelect value={status} onChange={e=>{setStatus(e.target.value as LecturerApplicationStatus|'');setPage(0);setSelected(null)}}><option value="">All statuses</option>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</NativeSelect></Field><Button type="submit" variant="outline">Search</Button>
    </form>
    {loading?<LoadingState label="Loading applications…"/>:items.length?<DataTable caption="Lecturer applications" rowKey={a=>a.id} rows={items} columns={[
      {key:'name',header:'Applicant',cell:a=><><p>{a.full_name}</p><p className="break-all text-xs font-normal text-ink-muted">{a.email}</p></>},
      {key:'university',header:'Institution',cell:a=><>{a.university}<p className="text-xs text-ink-muted">{a.department}</p></>},
      {key:'status',header:'Status',cell:a=><Badge tone={a.status==='approved'?'success':'warning'}>{labels[a.status]}</Badge>},
      {key:'email',header:'Email',cell:a=>a.email_verified?'Verified':'Unverified'},
      {key:'action',header:'Action',action:true,cell:a=><Button size="sm" variant="outline" disabled={busy} onClick={()=>void open(a.id)}>Review</Button>},
    ]}/>:<EmptyState title="No applications found" description="Try another status or search. New lecturer applications will appear here."/>}
    <div className="my-4 flex items-center justify-between gap-3 text-sm"><p>{total} applications · Page {page+1} of {Math.max(1,Math.ceil(total/20))}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!page||loading} onClick={()=>setPage(p=>p-1)}>Previous</Button><Button size="sm" variant="outline" disabled={(page+1)*20>=total||loading} onClick={()=>setPage(p=>p+1)}>Next</Button></div></div>
    {detailLoading?<LoadingState label="Loading application details…"/>:null}
    {selected?<section aria-label="Application details" className="mt-6 flex flex-col gap-5">
      <Card><CardHeader><CardTitle>{selected.full_name}</CardTitle></CardHeader><CardContent><dl className="grid gap-4 sm:grid-cols-2">{[['Email',selected.email],['University',selected.university],['Faculty',selected.faculty],['Department',selected.department],['Position',selected.position],['Requested courses',selected.requested_courses],['Verification information',selected.verification_note||'Not provided']].map(([k,v])=><div key={k}><dt className="text-sm text-ink-muted">{k}</dt><dd className="break-words whitespace-pre-wrap">{v}</dd></div>)}</dl>{selected.institutional_profile_url?<a className="mt-4 inline-block text-brand-primary underline" href={selected.institutional_profile_url} target="_blank" rel="noopener noreferrer">Open institutional profile</a>:null}</CardContent></Card>
      {!selected.email_verified?<Alert tone="warning">The applicant has not confirmed their email. Approval is blocked; you may request changes or reject.</Alert>:null}
      {selected.status==='pending'||selected.status==='approved'?<Card><CardHeader><CardTitle>{selected.status==='approved'?'Teaching assignments':'Review decision'}</CardTitle></CardHeader><CardContent><form className="flex flex-col gap-4" onSubmit={e=>void submit(e)} onChange={()=>{requestKey.current=null;setError(null)}}>
        {selected.status==='pending'?<><Field id="review-decision" label="Decision"><NativeSelect value={decision} onChange={e=>setDecision(e.target.value as typeof decision)}><option value="approved">Approve and activate</option><option value="changes_requested">Request changes</option><option value="rejected">Reject application</option></NativeSelect></Field><Field id="review-message" label="Message visible to the applicant" hint={decision==='approved'?'Optional welcome message.':'Explain the decision clearly (at least 8 characters).'}><textarea className="min-h-24 w-full rounded-control border border-line p-3" required={decision!=='approved'} minLength={decision!=='approved'?8:undefined} maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)}/></Field><Field id="review-note" label="Internal note" hint="Administrators only. This note is never included in the applicant response."><textarea className="min-h-20 w-full rounded-control border border-line p-3" maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></Field></>:null}
        {selected.status==='approved'||decision==='approved'?<fieldset><legend className="font-semibold">Assign published course offerings (optional)</legend><p className="mb-3 text-sm text-ink-muted">Verify the applicant’s institution and department before assigning. Access can be approved without courses.</p><Field id="offering-search" label="Find a course offering"><Input value={offeringSearch} onChange={e=>setOfferingSearch(e.target.value)}/></Field><div className="mt-3 max-h-72 overflow-y-auto">{offerings.filter(o=>(o.code+' '+o.title+' '+o.university+' '+o.department).toLowerCase().includes(offeringSearch.toLowerCase())).map(o=><label key={o.id} className="flex items-start gap-3 border-t border-line py-3 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={offeringIds.includes(o.id)} onChange={e=>setOfferingIds(ids=>e.target.checked?[...ids,o.id]:ids.filter(id=>id!==o.id))}/><span><strong>{o.code} · {o.title}</strong><span className="block text-xs text-ink-muted">{o.university} · {o.department} · {o.period} · {o.semester}</span></span></label>)}</div>{!offerings.length?<p className="text-sm text-ink-muted">No published offerings are available yet.</p>:null}</fieldset>:null}
        <Button type="submit" loading={busy} disabled={selected.status==='pending'&&decision==='approved'&&!selected.email_verified}>{selected.status==='approved'?'Save course assignments':decision==='approved'?'Approve application':decision==='rejected'?'Reject application':'Request changes'}</Button>
      </form></CardContent></Card>:<Alert>{labels[selected.status]}. Decisions are read-only until the applicant resubmits requested corrections.</Alert>}
      {selected.history?.length?<Card><CardHeader><CardTitle>Review history</CardTitle></CardHeader><CardContent>{selected.history.map((h,i)=><div key={i} className="border-t border-line py-3"><p className="font-semibold">{h.action.replaceAll('_',' ')}</p><p className="text-xs text-ink-muted">{new Date(h.created_at).toLocaleString('en-GB',{timeZone:'Africa/Lagos'})} WAT</p><p className="whitespace-pre-wrap text-sm">{h.applicant_message}</p>{h.internal_note?<p className="mt-2 whitespace-pre-wrap rounded-control bg-surface-tint p-3 text-sm"><strong>Internal: </strong>{h.internal_note}</p>:null}</div>)}</CardContent></Card>:null}
    </section>:null}
  </>;
}
