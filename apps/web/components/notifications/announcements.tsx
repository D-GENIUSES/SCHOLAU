"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { newRequestKey } from "@scholau/api";
import { useScholauApi } from "@scholau/api/react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";

const field = "mt-1 block min-h-11 w-full rounded-control border border-line bg-surface-card px-3";

export function Announcements({ admin = false }: { admin?: boolean }) {
  const api = useScholauApi();
  const audiences = useQuery({ queryKey: ["scholau", "announcement-audiences"], queryFn: () => api.getAnnouncementAudiences() });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("");
  const [audience, setAudience] = useState<"offering" | "role" | "everyone">("offering");
  const [audienceId, setAudienceId] = useState("");
  const [preview, setPreview] = useState<{ count: number; fingerprint: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [request, setRequest] = useState<{ fingerprint: string; key: string } | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const fingerprint = JSON.stringify({ title, body, target, audience, audienceId });
  const currentPreview = preview?.fingerprint === fingerprint ? preview : null;
  if (audiences.isPending) return <LoadingState label="Loading announcement audiences…" />;
  if (audiences.isError) return <ErrorState error={audiences.error} onRetry={() => void audiences.refetch()} />;
  async function prepare() {
    setPending(true); setMessage(""); setConfirmed(false);
    try {
      const result = await api.previewAnnouncement({ audience, audienceId: audience === "everyone" ? null : audienceId });
      setPreview({ count: result.recipient_count, fingerprint });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not preview recipients."); }
    finally { setPending(false); }
  }
  async function send() {
    if (!currentPreview || !confirmed) return;
    const key = request?.fingerprint === fingerprint ? request.key : newRequestKey();
    setRequest({ fingerprint, key }); setPending(true); setMessage("");
    try {
      const result = await api.sendAnnouncement({ title, body, target: target || null, audience, audienceId: audience === "everyone" ? null : audienceId, requestKey: key });
      setMessage(`Announcement queued for ${result.recipient_count} recipients. Push follows each person’s preferences and quiet hours.`);
      setPreview(null); setConfirmed(false); setTitle(""); setBody(""); setTarget(""); setRequest(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sending failed. Retry to reuse the same request."); }
    finally { setPending(false); }
  }
  return <div className="grid max-w-2xl gap-5">
    <h1 className="text-3xl font-bold">Send an announcement</h1>
    <p className="text-ink-muted">Messages appear in recipients’ inboxes. Enabled devices receive push outside quiet hours. The default limit is five announcements per hour.</p>
    <form className="grid gap-5 rounded-card border border-line bg-surface-card p-5" onSubmit={(event) => { event.preventDefault(); void prepare(); }}>
      <label>Title<input className={field} required maxLength={100} value={title} disabled={pending} onChange={(event) => { setTitle(event.target.value); setConfirmed(false); }} /></label>
      <label>Message<textarea aria-label="Message" className={`${field} min-h-28 py-3`} required maxLength={500} value={body} disabled={pending} onChange={(event) => { setBody(event.target.value); setConfirmed(false); }} /></label>
      <label>Destination (optional)<input className={field} maxLength={200} pattern="/[A-Za-z0-9/_-]*" placeholder="/home" value={target} disabled={pending} onChange={(event) => { setTarget(event.target.value); setConfirmed(false); }} /></label>
      {admin ? <label>Audience<select aria-label="Audience" className={field} value={audience} disabled={pending} onChange={(event) => { setAudience(event.target.value as typeof audience); setAudienceId(""); setConfirmed(false); }}><option value="offering">Course offering</option><option value="role">Account role</option><option value="everyone">Everyone</option></select></label> : null}
      {audience === "offering" ? <label>Course offering<select aria-label="Course offering" className={field} required disabled={pending} value={audienceId} onChange={(event) => { setAudienceId(event.target.value); setConfirmed(false); }}><option value="">Select a course offering</option>{audiences.data.offerings.map((offering) => <option key={offering.id} value={offering.id}>{offering.label}</option>)}</select></label> : null}
      {audience === "role" ? <label>Role<select aria-label="Role" className={field} required disabled={pending} value={audienceId} onChange={(event) => { setAudienceId(event.target.value); setConfirmed(false); }}><option value="">Select a role</option><option value="student">Students</option><option value="lecturer">Lecturers</option><option value="admin">Admins</option></select></label> : null}
      <Button type="submit" loading={pending}>Preview recipients</Button>
      {currentPreview ? <div className="grid gap-3 rounded-control bg-surface-tint p-4">
        <p>{currentPreview.count} current recipients. Membership is checked again and snapshotted when you send.</p>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="size-5" checked={confirmed} disabled={pending} onChange={(event) => setConfirmed(event.target.checked)} />I have reviewed the audience and message.</label>
        <Button type="button" disabled={!confirmed || currentPreview.count === 0 || pending} onClick={() => void send()}>Confirm and send</Button>
      </div> : null}
    </form>
    <p role="status" aria-live="polite">{message}</p>
    {admin ? <PushHealth /> : null}
  </div>;
}

function PushHealth() {
  const api = useScholauApi();
  const health = useQuery({ queryKey: ["scholau", "push-health"], queryFn: () => api.getPushHealth(), refetchInterval: 30_000 });
  if (health.isPending) return <LoadingState label="Loading notification delivery health…" />;
  if (health.isError) return <ErrorState error={health.error} onRetry={() => void health.refetch()} />;
  return <section className="rounded-card border border-line bg-surface-card p-5" aria-labelledby="delivery-health">
    <h2 id="delivery-health" className="text-lg font-bold">Notification delivery health</h2>
    <p className="my-3">Delivery {health.data.delivery_enabled ? "enabled" : "paused"} · {health.data.pending_recipients} recipients waiting for inbox processing</p>
    <dl className="grid grid-cols-2 gap-3">{["pending", "sending", "accepted", "expired", "skipped", "failed"].map((state) => <div key={state}><dt className="capitalize">{state}</dt><dd className="text-xl font-bold">{health.data.states[state] ?? 0}</dd></div>)}</dl>
    <p className="mt-3 text-sm text-ink-muted">Accepted means the push provider accepted the request. Device delivery is not confirmed.</p>
    {health.data.oldest_pending_at ? <p className="mt-2 text-sm">Oldest pending: {new Date(health.data.oldest_pending_at).toLocaleString()}</p> : null}
    {health.data.failures.length ? <ul className="mt-3 text-sm">{health.data.failures.map((failure) => <li key={failure.id}>Failure {failure.id.slice(0, 8)} · code {failure.last_code} · {failure.attempts} attempts</li>)}</ul> : null}
  </section>;
}
