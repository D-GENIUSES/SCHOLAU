"use client";

import { useEffect, useState } from "react";
import { newRequestKey } from "@scholau/api";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Option = { offering_id: string; code: string; title: string; level: string; semester: string; period: string };
type RequestRow = { id: string; code: string; title: string; status: string; created_at: string };

export function CourseRequests() {
  const [search, setSearch] = useState(""); const [options, setOptions] = useState<Option[]>([]); const [requests, setRequests] = useState<RequestRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function load() { const { data, error } = await getBrowserSupabase().rpc("get_student_course_request_options_v1", { p_search: search }); if (!error) { const x = data as { courses?: Option[]; requests?: RequestRow[] }; setOptions(x.courses ?? []); setRequests(x.requests ?? []); } }
  useEffect(() => { void load(); }, [search]);
  async function submit() { if (!selected.length) return; setBusy(true); setMessage(null); const { error } = await getBrowserSupabase().rpc("create_student_course_requests_v1", { p_offering_ids: selected, p_request_key: newRequestKey() }); setBusy(false); if (error) setMessage(error.message); else { setSelected([]); setMessage("Course request sent for admin approval."); await load(); } }
  return <div className="space-y-4"><div><h2>Request additional courses</h2><p className="ps-muted">Choose up to three published courses offered in your department. An administrator must approve them.</p></div>
    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by course code or title" aria-label="Search available courses" />
    <div className="max-h-64 space-y-2 overflow-y-auto">{options.map(o => <label key={o.offering_id} className="flex min-h-11 items-center gap-3 rounded-control border border-line p-3 has-[:checked]:border-brand-primary has-[:checked]:bg-surface-tint"><input type="checkbox" className="size-4 accent-brand-primary" checked={selected.includes(o.offering_id)} disabled={!selected.includes(o.offering_id) && selected.length >= 3} onChange={() => setSelected(s => s.includes(o.offering_id) ? s.filter(x => x !== o.offering_id) : [...s, o.offering_id])} /><span className="min-w-0"><strong>{o.code} · {o.title}</strong><span className="block text-xs text-ink-muted">{o.level}{o.semester ? ` · ${o.semester}` : ""}{o.period ? ` · ${o.period}` : ""}</span></span></label>)}{!options.length ? <p className="text-sm text-ink-muted">No additional published courses are available.</p> : null}</div>
    {message ? <p role="status" className="text-sm text-ink-muted">{message}</p> : null}<Button onClick={() => void submit()} loading={busy} disabled={!selected.length}>Request selected ({selected.length}/3)</Button>
    {requests.length ? <div className="border-t border-line pt-4"><h3 className="font-semibold">Your requests</h3><ul className="mt-2 space-y-2">{requests.map(r => <li key={r.id} className="flex items-center justify-between gap-3 text-sm"><span>{r.code} · {r.title}</span><span className="shrink-0 text-xs font-semibold capitalize text-ink-muted">{r.status}</span></li>)}</ul></div> : null}
  </div>;
}
