"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { newRequestKey } from "@scholau/api";
import type { LecturerOffering } from "@scholau/core";
import { adminUsersApi, userManagementError, type ManagedUser } from "@/lib/admin-users-api";
import { lecturerApi } from "@/lib/lecturer-api";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useOnlineUsers, useUserInsights } from "@/lib/admin-insights";
import { AdminCreateUser } from "./admin-create-user";
import { AdminAwardXp } from "./admin-award-xp";
import { DataTable } from "./data-table";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, LoadingState } from "@/components/ui/states";

function date(value: string | null) {
  return value ? `${new Date(value).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })} WAT` : "Not available";
}
function roleLabel(user: ManagedUser) {
  if (user.roles.includes("lecturer")) return "Lecturer";
  if (user.category === "lecturer") return "Lecturer applicant";
  if (user.roles.includes("student")) return "Student";
  return user.roles.includes("admin") ? "Administrator" : "Unassigned";
}

export function AdminUserDirectory({ creationEnabled }: { creationEnabled: boolean }) {
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [onlinePage, setOnlinePage] = useState(0);
  const onlineUsers = useOnlineUsers(onlinePage);
  const [items, setItems] = useState<ManagedUser[]>([]);
  const insights = useUserInsights(items.map(user => user.id));
  const [infoId, setInfoId] = useState<string | null>(null);
  const info = insights.data?.items.find(user => user.id === infoId);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [detailNotice, setDetailNotice] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [offerings, setOfferings] = useState<LecturerOffering[]>([]);
  const [offeringError, setOfferingError] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [action, setAction] = useState<"freeze" | "reactivate" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const detailGeneration = useRef(0);
  const requestKey = useRef<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    const gen = ++generation.current;
    if (!quiet) { setLoading(true); setError(null); }
    try {
      const result = await adminUsersApi.list(category, status, query, page * 20);
      if (generation.current !== gen) return;
      if (page > 0 && page * 20 >= result.total) { setPage(Math.max(0, Math.ceil(result.total / 20) - 1)); return; }
      setItems(result.items); setTotal(result.total);
    } catch (err) { if (generation.current === gen) setError(userManagementError(err)); }
    finally { if (generation.current === gen) setLoading(false); }
  }, [category, status, query, page]);
  const invalidateLoad = useCallback(() => { generation.current++; }, []);
  useEffect(() => {
    let active = true;
    // Schedule the external fetch after the effect; cleanup invalidates in-flight responses.
    void Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; invalidateLoad(); };
  }, [load, invalidateLoad]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(true); }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => () => { detailGeneration.current++; }, []);

  async function manage(id: string) {
    const gen = ++detailGeneration.current;
    setOpen(true); setDetailLoading(true); setSelected(null); setDetailError(null); setDetailNotice(null);
    setAction(null); setReason(""); setConfirmation(""); setCourseSearch(""); setOfferingError(false);
    requestKey.current = null;
    const results = await Promise.allSettled([
      adminUsersApi.detail(id), lecturerApi(getBrowserSupabase()).offerings(),
    ]);
    if (gen !== detailGeneration.current) return;
    if (results[0].status === "fulfilled") {
      setSelected(results[0].value.user); setIds(results[0].value.user.assignments.map(a => a.id));
    } else setDetailError(userManagementError(results[0].reason));
    if (results[1].status === "fulfilled") setOfferings(results[1].value.items);
    else { setOfferings([]); setOfferingError(true); }
    setDetailLoading(false);
  }

  async function save(kind: "courses" | "freeze" | "reactivate" | "delete") {
    if (!selected || busyRef.current) return;
    if (kind !== "courses" && reason.trim().length < 3) { setDetailError("Enter a reason with at least 3 characters."); return; }
    if (kind === "delete" && confirmation.trim().toLowerCase() !== selected.email?.toLowerCase()) { setDetailError("Type the account email exactly to confirm deletion."); return; }
    busyRef.current = true; setBusy(true); setDetailError(null); setDetailNotice(null);
    requestKey.current ??= newRequestKey();
    try {
      if (kind === "delete") {
        await adminUsersApi.remove(selected, confirmation, reason, requestKey.current);
        setOpen(false); setSelected(null); setNotice("The account and its personal learning data have been deleted.");
      } else {
        const result = kind === "courses" ? await adminUsersApi.assign(selected, ids, requestKey.current) : await adminUsersApi.freeze(selected, kind === "freeze", reason, requestKey.current);
        setSelected(result.user); setIds(result.user.assignments.map(a => a.id)); setAction(null); setReason("");
        setDetailNotice(kind === "courses" ? "Teaching assignments saved." : kind === "freeze" ? "Account frozen." : "Account reactivated.");
        setNotice(kind === "courses" ? "Teaching assignments saved." : kind === "freeze" ? "Account frozen. Access is blocked until reactivated." : "Account reactivated.");
      }
      requestKey.current = null;
      await load();
    } catch (err) { setDetailError(userManagementError(err)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  const protectedAccount = selected?.roles.includes("admin") ?? false;
  const available = [...offerings, ...(selected?.assignments ?? []).filter(a => !offerings.some(o => o.id === a.id)).map(a => ({ ...a, university: "Previously assigned", department: "Unavailable for new assignments", period: "", semester: "" }))];
  const filtered = available.filter(o => `${o.code} ${o.title} ${o.university} ${o.department}`.toLowerCase().includes(courseSearch.toLowerCase()));

  return <>
    <div className="mb-2 grid grid-cols-2 gap-2">
      <div className="rounded-xl border border-line bg-surface-card px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Total users</p><p className="text-xl font-bold tabular-nums">{onlineUsers.data?.total_users ?? insights.data?.total_users ?? "—"}</p></div>
      <button type="button" className="rounded-xl border border-line bg-surface-card px-3 py-2 text-left hover:border-brand-primary focus-visible:outline-2 focus-visible:outline-brand-primary" aria-haspopup="dialog" aria-expanded={onlineOpen} onClick={() => { setOnlinePage(0); setOnlineOpen(true); }}>
        <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-muted">Online in app</span>
        <span className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xl font-bold tabular-nums"><span className="size-2 rounded-full bg-green-500" aria-hidden />{onlineUsers.isError ? "—" : onlineUsers.data?.total ?? "—"}</span><span className="text-xs text-brand-primary">View ›</span></span>
      </button>
    </div>
    <p className="mb-3 text-[11px] text-ink-muted">Online users appear first. Active anywhere in the app within 90 seconds; refreshes every 15 seconds.</p>
    <Dialog open={onlineOpen} onOpenChange={setOnlineOpen}><DialogContent className="max-w-md"><DialogTitle>Online in the app · {onlineUsers.data?.total ?? "—"}</DialogTitle><DialogDescription>Users active anywhere in ScholAu within the last 90 seconds, across all directory pages.</DialogDescription>
      {onlineUsers.isError ? <Alert tone="warning">Could not load online users. <Button variant="ghost" onClick={() => void onlineUsers.refetch()}>Retry</Button></Alert> : onlineUsers.isPending ? <p role="status">Loading online users…</p> : <>
        <ul className="max-h-[55dvh] overflow-y-auto divide-y divide-line">{onlineUsers.data.items.map(user => <li key={user.id} className="flex items-center gap-2 py-2"><Avatar name={user.display_name || "User"} path={user.avatar_path} size={32} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user.display_name || "User"}</p><p className="truncate text-xs text-ink-muted">{user.email}</p></div><Button variant="ghost" size="sm" onClick={() => { setOnlineOpen(false); void manage(user.id); }}>Manage</Button></li>)}</ul>
        {!onlineUsers.data.items.length ? <p className="text-sm text-ink-muted">No users are currently active.</p> : null}
        {onlineUsers.data.total > 50 ? <div className="flex justify-between"><Button size="sm" variant="outline" disabled={onlinePage === 0} onClick={() => setOnlinePage(value => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={(onlinePage + 1) * 50 >= onlineUsers.data.total} onClick={() => setOnlinePage(value => value + 1)}>Next</Button></div> : null}
      </>}
    </DialogContent></Dialog>
    {insights.isError && <Alert tone="warning">Activity and online status are unavailable. <Button variant="ghost" onClick={() => void insights.refetch()}>Retry</Button></Alert>}
    <Dialog open={Boolean(infoId)} onOpenChange={open => {if (!open) setInfoId(null);}}><DialogContent className="max-w-lg"><DialogTitle>{items.find(user => user.id === infoId)?.display_name || "User information"}</DialogTitle><DialogDescription>Academic details and today&apos;s activity. Resets at midnight WAT.</DialogDescription>{info ? <><dl className="grid grid-cols-2 gap-3 text-sm">{[["Department",info.department],["Faculty",info.faculty],["Level",info.level],["Status",info.online ? "Online" : "Offline"]].map(([label,value]) => <div key={label}><dt className="text-ink-muted">{label}</dt><dd>{value || "Not provided"}</dd></div>)}</dl><h3 className="text-sm font-semibold">Today · {info.events.length} {info.events.length === 1 ? "activity" : "activities"}</h3><ul className="max-h-72 overflow-y-auto divide-y divide-line">{info.events.map(event => <li key={event.id} className="flex justify-between gap-3 py-2 text-sm"><span>{event.label}</span><time className="shrink-0 text-xs text-ink-muted">{new Date(event.at).toLocaleTimeString("en-GB",{timeZone:"Africa/Lagos",hour:"2-digit",minute:"2-digit"})}</time></li>)}</ul>{!info.events.length && <p className="text-sm text-ink-muted">No activity today.</p>}</> : <p className="text-sm">{insights.isError ? "Unable to load user activity." : "Loading information..."}</p>}</DialogContent></Dialog>
    <details className="mb-4 rounded-control border border-line bg-surface-card p-3 shadow-card">
      <summary className="cursor-pointer text-sm font-semibold">Add a student or lecturer</summary>
      <div className="mt-3 border-t border-line pt-3">
        <AdminCreateUser enabled={creationEnabled} onCreated={() => { void load(); }} />
      </div>
    </details>
    {notice ? <Alert tone="success" role="status" className="mb-3">{notice}</Alert> : null}
    {error ? (
      <Alert tone="error" role="alert" className="mb-3" action={<Button variant="outline" onClick={() => void load()}>Retry</Button>}>
        {error}
      </Alert>
    ) : null}
    <form
      className="admin-filter-form mb-4 flex flex-wrap items-end gap-2 rounded-control border border-line bg-surface-page/70 p-3"
      onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(0); }}
    >
      <Field id="users-search" label="Search users"><Input value={search} maxLength={200} placeholder="Name or email" onChange={e => setSearch(e.target.value)} /></Field>
      <Field id="users-type" label="Account type"><NativeSelect value={category} onChange={e => { setCategory(e.target.value); setPage(0); }}><option value="">All</option><option value="student">Students</option><option value="lecturer">Lecturers</option><option value="other">Other</option></NativeSelect></Field>
      <Field id="users-status" label="Account status"><NativeSelect value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">All</option><option value="active">Active</option><option value="frozen">Frozen</option></NativeSelect></Field>
      <Button type="submit" variant="outline">Search</Button><Button variant="ghost" onClick={() => void load()}>Refresh</Button>
    </form>
    {loading ? <LoadingState variant="table" label="Loading registered users..." /> : error ? null : items.length ? <DataTable caption="Registered users" rows={items} rowKey={user => user.id} mobileCard={user => <>
      <div className="flex items-center gap-2"><Avatar name={user.display_name || "User"} path={user.avatar_path} size={32} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user.display_name || "No profile name"}</p><p className="truncate text-[11px] text-ink-muted">{user.email || "No email"}</p></div><span className={`shrink-0 text-[11px] ${user.online ? "text-success" : "text-ink-muted"}`}>{user.online ? "● Online" : "Offline"}</span></div>
      <div className="mt-1 flex items-center justify-between gap-2"><p className="text-[11px] text-ink-muted">{roleLabel(user)} · {user.deactivated_at ? "Frozen" : "Active"}{user.application_status ? ` · ${user.application_status.replaceAll("_", " ")}` : ""}</p></div>
      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-line pt-1.5"><Button variant="ghost" size="sm" className="px-2" aria-label={`Information and activity for ${user.display_name || "user"}`} onClick={() => setInfoId(user.id)}>Today: {insights.isError ? "—" : insights.data?.items.find(item => item.id === user.id)?.events.length ?? "—"} · Info</Button><Button variant="outline" size="sm" onClick={() => void manage(user.id)}>Manage</Button></div>
    </>} columns={[
      { key: "name", header: "User", cell: user => <div className="flex items-center gap-3"><Avatar name={user.display_name || "User"} path={user.avatar_path} size={32} /><div className="min-w-0"><p>{user.display_name || "No profile name"}</p><p className="break-all text-xs font-normal text-ink-muted">{user.email || "No email"}</p></div></div> },
      { key: "type", header: "Account type", cell: user => <>{roleLabel(user)}{user.roles.includes("admin") && <Badge tone="brand">Admin</Badge>}</> },
      { key: "today", header: "Today", cell: user => <Button variant="ghost" size="sm" onClick={() => setInfoId(user.id)}>{insights.isError ? "Unavailable" : `${insights.data?.items.find(item => item.id === user.id)?.events.length ?? "—"} ${insights.data?.items.find(item => item.id === user.id)?.events.length === 1 ? "activity" : "activities"}`}</Button> },
      { key: "online", header: "Online", cell: user => { const insight = typeof user.online === "boolean" ? { online: user.online } : undefined; return <span className="inline-flex items-center gap-1.5 text-xs"><span aria-hidden className={`size-2 rounded-full ${insight?.online ? "bg-green-500" : "bg-gray-300"}`} />{insight ? insight.online ? "Online" : "Offline" : "Unknown"}</span>; } },
      { key: "registered", header: "Registered", cell: user => date(user.registered_at) },
      { key: "status", header: "Status", cell: user => <><Badge tone={user.deactivated_at ? "warning" : "success"}>{user.deactivated_at ? "Frozen" : "Active"}</Badge>{user.application_status && <p className="mt-1 text-xs text-ink-muted">Application: {user.application_status.replaceAll("_", " ")}</p>}</> },
      { key: "action", header: "Actions", action: true, cell: user => <div className="flex gap-1"><Button variant="ghost" size="sm" aria-label={`Information for ${user.display_name || "user"}`} onClick={() => setInfoId(user.id)}>Info</Button><Button variant="outline" size="sm" onClick={() => void manage(user.id)}>Manage</Button></div> },
    ]} /> : <EmptyState title="No users found" description="Try a different name, email or filter." />}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
      <p className="text-ink-muted">{total} users · Page {page + 1} of {Math.max(1, Math.ceil(total / 20))}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={(page + 1) * 20 >= total || loading} onClick={() => setPage(p => p + 1)}>Next</Button>
      </div>
    </div>

    <Dialog open={open} onOpenChange={value => { if (busyRef.current) return; setOpen(value); if (!value) detailGeneration.current++; }}>
      <DialogContent className="max-w-2xl" hideClose={busy}>
        <DialogTitle>{selected?.display_name || "Manage account"}</DialogTitle>
        <DialogDescription>{selected?.email || "Account access and teaching assignments."}</DialogDescription>
        {detailLoading && <LoadingState variant="table" label="Loading account details..." />}
        {detailError && <Alert tone="error" role="alert">{detailError}</Alert>}
        {detailNotice && <Alert tone="success" role="status">{detailNotice}</Alert>}
        {selected && <>
          <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-ink-muted">Registered</dt><dd>{date(selected.registered_at)}</dd></div><div><dt className="text-ink-muted">Last sign-in</dt><dd>{date(selected.last_sign_in_at)}</dd></div><div><dt className="text-ink-muted">Account type</dt><dd>{roleLabel(selected)}</dd></div><div><dt className="text-ink-muted">Email</dt><dd>{selected.email_verified ? "Verified" : "Unverified"}</dd></div><div><dt className="text-ink-muted">Access</dt><dd>{selected.deactivated_at ? `Frozen since ${date(selected.deactivated_at)}` : "Active"}</dd></div></dl>
          {!selected.has_profile && <Alert tone="warning">This account has no application profile. Account actions are unavailable.</Alert>}
          {protectedAccount && <Alert>Administrator accounts are protected from suspension and deletion.</Alert>}
          <AdminAwardXp key={selected.id} user={selected} disabled={busy} onBusyChange={value => { busyRef.current = value; setBusy(value); }} />
          {action ? <form className="flex flex-col gap-4 rounded-control border border-line p-4" onSubmit={event => { event.preventDefault(); void save(action); }} onChange={() => { requestKey.current = null; }}>
            <h3 className="font-bold">{action === "delete" ? "Permanently delete this account" : action === "freeze" ? "Freeze this account" : "Reactivate this account"}</h3>
            <p className="text-sm text-ink-muted">{action === "delete" ? "This permanently removes the sign-in account, personal progress, enrollments and teaching assignments. This cannot be undone." : action === "freeze" ? "The user loses application access. Their data and teaching assignments are kept for reactivation." : "The user will regain access to their account and existing assignments."}</p>
            <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4"><legend className="sr-only">Confirm account action</legend>
              <Field id="account-reason" label="Reason"><Textarea value={reason} minLength={3} maxLength={500} required onChange={e => setReason(e.target.value)} /></Field>
              {action === "delete" && <Field id="delete-user-confirmation" label="Type the account email to confirm"><Input type="email" autoComplete="off" value={confirmation} required onChange={e => setConfirmation(e.target.value)} /></Field>}
              <div className="flex flex-wrap gap-2"><Button type="submit" variant={action === "delete" ? "danger" : "primary"} loading={busy}>{action === "delete" ? "Permanently delete account" : action === "freeze" ? "Confirm freeze" : "Confirm reactivation"}</Button><Button variant="outline" onClick={() => { setAction(null); setDetailError(null); requestKey.current = null; }}>Cancel</Button></div>
            </fieldset>
          </form> : <>
            {selected.has_profile && !protectedAccount && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => { setAction(selected.deactivated_at ? "reactivate" : "freeze"); setReason(""); setDetailError(null); requestKey.current = null; }}>{selected.deactivated_at ? "Reactivate account" : "Freeze account"}</Button><Button variant="danger" disabled={busy || !selected.email} onClick={() => { setAction("delete"); setReason(""); setConfirmation(""); setDetailError(null); requestKey.current = null; }}>Delete account</Button></div>}
            {selected.roles.includes("lecturer") ? <form className="mt-2 flex flex-col gap-4 border-t border-line pt-4" onSubmit={event => { event.preventDefault(); void save("courses"); }}>
              <h3 className="font-bold">Teaching assignments</h3>
              <p className="text-sm text-ink-muted">Select the published course offerings this lecturer teaches. Clear all selections to remove their assignments.</p>
              {selected.deactivated_at && <Alert tone="warning">Reactivate this account before changing its teaching assignments.</Alert>}
              {offeringError && <Alert tone="warning">Course offerings could not be loaded. Close this panel and reopen it to retry.</Alert>}
              <fieldset disabled={busy || Boolean(selected.deactivated_at) || offeringError} className="flex min-w-0 flex-col gap-3"><legend className="sr-only">Select lecturer courses</legend>
                <Field id="user-course-search" label="Find a course"><Input value={courseSearch} onChange={e => setCourseSearch(e.target.value)} placeholder="Course code, title or department" /></Field>
                <p className="text-sm">{ids.length} selected</p>
                <div className="max-h-64 overflow-y-auto">{filtered.map(o => <label key={o.id} className="flex items-start gap-3 border-t border-line py-3 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={ids.includes(o.id)} onChange={e => { setIds(current => e.target.checked ? [...current, o.id] : current.filter(id => id !== o.id)); requestKey.current = null; }} /><span><strong>{o.code} · {o.title}</strong><span className="block text-xs text-ink-muted">{o.university} · {o.department} · {o.period} · {o.semester}</span></span></label>)}{!filtered.length && <p className="text-sm text-ink-muted">No course offerings match this search.</p>}</div>
                <Button type="submit" loading={busy}>Save teaching assignments</Button>
              </fieldset>
            </form> : selected.category === "lecturer" ? <Alert>Approve this lecturer&apos;s application before assigning courses.</Alert> : null}
          </>}
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
