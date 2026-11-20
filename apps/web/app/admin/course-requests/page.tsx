"use client";

import { useEffect, useState } from "react";
import { newRequestKey } from "@scholau/api";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AdminPageHeader, AdminErrorState } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState } from "@/components/ui/states";

type Row = { id: string; student_name: string; code: string; title: string; level: string; semester: string; created_at: string; status: string };
export default function AdminCourseRequestsPage() { const [rows,setRows]=useState<Row[]>([]); const [busy,setBusy]=useState<string|null>(null); const [error,setError]=useState<string|null>(null);
  async function load(){ const {data,error}=await getBrowserSupabase().rpc("admin_list_course_requests_v1",{p_status:"pending"}); if(error)setError(error.message); else setRows(((data as {requests?:Row[]})?.requests??[])); } useEffect(()=>{void load()},[]);
  async function review(id:string,decision:"approved"|"rejected"){setBusy(id);setError(null);const {error}=await getBrowserSupabase().rpc("admin_review_course_request_v1",{p_request_id:id,p_decision:decision,p_request_key:newRequestKey()});setBusy(null);if(error)setError(error.message);else await load();}
  return <><AdminPageHeader title="Course requests" description="Review student requests for additional department courses." />{error?<AdminErrorState error={new Error(error)} onRetry={()=>void load()} />:rows.length===0?<EmptyState title="No pending requests" description="New course requests will appear here." />:<div className="space-y-3">{rows.map(r=><article key={r.id} className="rounded-card border border-line bg-surface-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{r.student_name}</h2><p className="text-sm">{r.code} · {r.title}</p><p className="text-xs text-ink-muted">{r.level}{r.semester?` · ${r.semester}`:""}</p></div><div className="flex gap-2"><Button size="sm" loading={busy===r.id} onClick={()=>void review(r.id,"approved")}>Approve</Button><Button size="sm" variant="outline" disabled={busy===r.id} onClick={()=>void review(r.id,"rejected")}>Reject</Button></div></div></article>)}</div>}</>;
}
