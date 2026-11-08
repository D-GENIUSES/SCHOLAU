"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { newRequestKey, parseRpcError } from "@scholau/api";
import type { LecturerOffering } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { lecturerApi } from "@/lib/lecturer-api";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Post = {
  id: string;
  offering_id: string;
  course_label?: string;
  title: string;
  body: string;
  status: "scheduled" | "published" | "cancelled" | "failed";
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  recipient_count: number;
  failure_reason: string | null;
  revision: number;
};

const statuses = { scheduled: "Scheduled", published: "Published", cancelled: "Cancelled", failed: "Couldn’t publish" };
const field = "mt-1.5 block min-h-11 w-full rounded-control border border-line bg-surface-card px-3 focus-visible:outline-2 focus-visible:outline-brand-primary";
const pageSize = 20;

async function request<T>(name: string, args: Record<string, unknown>) {
  const { data, error, status } = await getBrowserSupabase().rpc(name, args);
  if (error) throw parseRpcError(error, status);
  return data as T;
}

function localInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function showDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function LecturerAnnouncements({ initialCourse }: { initialCourse?: string }) {
  const [offset, setOffset] = useState(0);
  const [editor, setEditor] = useState<{ post?: Post } | null>(initialCourse ? {} : null);
  const [cancelPost, setCancelPost] = useState<Post | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState(false);
  const courses = useQuery({
    queryKey: ["scholau", "lecturer-announcement-courses"],
    queryFn: () => lecturerApi(getBrowserSupabase()).courses(),
  });
  const history = useQuery({
    queryKey: ["scholau", "lecturer-announcement-history", offset],
    queryFn: () => request<{ items: Post[] }>("list_lecturer_announcements_v1", { p_offset: offset }),
    refetchInterval: 30_000,
  });

  function saved(post: Post) {
    setEditor(null);
    setProblem(post.status === "failed");
    setMessage(post.status === "scheduled" && post.scheduled_at
      ? `Scheduled for ${showDate(post.scheduled_at)}.`
      : post.status === "published" ? `Published to ${post.recipient_count} ${post.recipient_count === 1 ? "student" : "students"}.` : post.failure_reason ?? "Couldn’t publish.");
    setOffset(0);
    void history.refetch();
  }

  async function cancel() {
    if (!cancelPost) return;
    setCancelling(true);
    try {
      await request<Post>("cancel_lecturer_announcement_v1", { p_id: cancelPost.id, p_revision: cancelPost.revision });
      setProblem(false);
      setMessage("Announcement cancelled.");
    } catch (error) {
      setProblem(true);
      setMessage(error instanceof Error ? error.message : "Couldn’t cancel the announcement.");
    } finally {
      setCancelPost(null);
      setCancelling(false);
      void history.refetch();
    }
  }

  const posts = history.data?.items ?? [];
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Send updates to students in the classes you teach.</p>
        </div>
        {!editor && courses.data?.items.length ? (
          <Button onClick={() => { setMessage(""); setEditor({}); }}><Plus className="size-4" aria-hidden /> New announcement</Button>
        ) : null}
      </header>
      {courses.isPending ? <LoadingState label="Loading your classes…" /> : null}
      {courses.error ? <ErrorState error={courses.error} onRetry={() => void courses.refetch()} /> : null}
      {courses.data && !courses.data.items.length ? <p className="text-sm text-ink-muted">Your classes will appear here once they’re assigned to you.</p> : null}
      {message ? <p role={problem ? "alert" : "status"} className={problem ? "text-sm text-danger" : "text-sm text-ink"}>{message}</p> : null}

      {editor && courses.data?.items.length ? (
        <Composer
          key={editor.post?.id ?? "new"}
          courses={courses.data.items}
          post={editor.post}
          initialCourse={initialCourse}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      ) : null}

      <section className="space-y-3" aria-labelledby="announcement-history">
        <h2 id="announcement-history" className="text-lg font-bold">Your announcements</h2>
        {history.isPending ? <LoadingState label="Loading announcements…" /> : null}
        {history.error ? <ErrorState error={history.error} onRetry={() => void history.refetch()} /> : null}
        {history.data && !posts.length ? <p className="rounded-card border border-line px-4 py-5 text-sm text-ink-muted">No announcements yet.</p> : null}
        {posts.length ? (
          <ul className="divide-y divide-line rounded-card border border-line">
            {posts.slice(0, pageSize).map((post) => (
              <li key={post.id} className="space-y-2 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="min-w-0 wrap-break-word font-semibold">{post.title}</h3>
                  <span className="rounded-pill bg-surface-tint px-2.5 py-1 text-xs font-semibold">{statuses[post.status]}</span>
                </div>
                <p className="text-xs text-ink-muted">{post.course_label ?? "Course offering"} · {showDate(post.published_at ?? post.scheduled_at ?? post.created_at)}</p>
                <p className="whitespace-pre-wrap wrap-break-word text-sm">{post.body}</p>
                {post.status === "published" ? <p className="text-sm text-ink-muted">{post.recipient_count} {post.recipient_count === 1 ? "student" : "students"}</p> : null}
                {post.failure_reason ? <p className="text-sm text-danger">{post.failure_reason}</p> : null}
                {post.status === "scheduled" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setMessage(""); setEditor({ post }); }}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setCancelPost(post)}>Cancel schedule</Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {offset > 0 || posts.length > pageSize ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!offset} onClick={() => setOffset(offset - pageSize)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={posts.length <= pageSize} onClick={() => setOffset(offset + pageSize)}>Next</Button>
          </div>
        ) : null}
      </section>
      <ConfirmDialog open={Boolean(cancelPost)} onOpenChange={(open) => { if (!open && !cancelling) setCancelPost(null); }}
        title="Cancel this announcement?" description="The announcement will be removed from the publishing schedule."
        confirmLabel="Cancel announcement" cancelLabel="Keep scheduled" destructive loading={cancelling}
        onConfirm={() => void cancel()} />
    </div>
  );
}

function Composer({ courses, post, initialCourse, onClose, onSaved }: {
  courses: LecturerOffering[];
  post?: Post;
  initialCourse?: string;
  onClose: () => void;
  onSaved: (post: Post) => void;
}) {
  const [offering, setOffering] = useState(() => {
    const preferred = post?.offering_id ?? initialCourse;
    return courses.find(({ id }) => id === preferred)?.id ?? (courses.length === 1 ? courses[0]?.id : undefined) ?? "";
  });
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [schedule, setSchedule] = useState(Boolean(post?.scheduled_at));
  const [date, setDate] = useState(localInput(post?.scheduled_at ?? null));
  const [preview, setPreview] = useState<{ form: string; count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLDivElement>(null);
  useEffect(() => { titleInput.current?.focus(); }, []);
  const form = JSON.stringify([offering, title, body, schedule, date]);
  const requestKey = useRef<{ form: string; key: string } | null>(null);
  const activePreview = preview?.form === form ? preview : null;
  const course = courses.find(({ id }) => id === offering);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function previewAudience(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (schedule) {
        const publishTime = new Date(date);
        if (!(publishTime.getTime() > Date.now())) throw new Error("Choose a publish time in the future.");
        if (localInput(publishTime.toISOString()) !== date) throw new Error("That time doesn’t exist in your time zone. Choose another time.");
      }
      const result = await request<{ recipient_count: number }>("preview_lecturer_announcement_v1", { p_offering_id: offering });
      setPreview({ form, count: result.recipient_count });
      requestAnimationFrame(() => confirmation.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t preview the audience.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!activePreview || (!schedule && !activePreview.count) || busy) return;
    setBusy(true);
    setError("");
    if (requestKey.current?.form !== form) requestKey.current = { form, key: newRequestKey() };
    try {
      const result = await request<Post>("save_lecturer_announcement_v1", {
        p_offering_id: offering, p_title: title, p_body: body,
        p_scheduled_at: schedule ? new Date(date).toISOString() : null,
        p_request_key: requestKey.current.key,
        p_id: post?.id ?? null, p_revision: post?.revision ?? null,
      });
      onSaved(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save the announcement. Try again.");
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-card border border-line bg-surface-card p-4 sm:p-6" onSubmit={(event) => void previewAudience(event)}>
      <h2 className="text-lg font-bold">{post ? "Edit announcement" : "New announcement"}</h2>
      <label className="text-sm font-semibold">Audience
        <select className={field} value={offering} onChange={(event) => setOffering(event.target.value)} required disabled={busy}>
          <option value="">Choose a class</option>
          {courses.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.title} · {item.department} · {item.semester} · {item.period}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">Title
        <input ref={titleInput} className={field} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required disabled={busy} />
      </label>
      <label className="text-sm font-semibold">Message
        <textarea className={`${field} min-h-28 py-3`} value={body} onChange={(event) => setBody(event.target.value)} maxLength={500} required disabled={busy} />
      </label>
      <fieldset className="flex flex-wrap gap-x-5 gap-y-1 text-sm" disabled={busy}>
        <legend className="font-semibold">Publish time</legend>
        <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="publish-time" checked={!schedule} onChange={() => setSchedule(false)} /> Publish now</label>
        <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="publish-time" checked={schedule} onChange={() => setSchedule(true)} /> Schedule</label>
      </fieldset>
      {schedule ? (
        <label className="min-w-0 text-sm font-semibold">Date and time <span className="font-normal text-ink-muted">({zone})</span>
          <input type="datetime-local" className={`${field} min-w-0`} value={date} onChange={(event) => setDate(event.target.value)} required disabled={busy} />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={busy || !title.trim() || !body.trim() || !offering}>Preview audience</Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Close</Button>
      </div>
      {activePreview && course ? (
        <div ref={confirmation} tabIndex={-1} className="grid gap-2 rounded-control bg-surface-tint p-4 text-sm">
          <p className="font-semibold">{course.code} · {course.title} · {course.department} · {course.semester} · {course.period}</p>
          <p>{activePreview.count} currently enrolled. {schedule ? "Enrolment is checked again when the announcement publishes." : "Students receive the announcement in their inbox."}</p>
          {schedule ? <p>{new Date(date).toLocaleString(undefined, {
            year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "shortOffset",
          })} ({zone})</p> : null}
          <Button type="button" className="justify-self-start" disabled={busy || (!schedule && activePreview.count === 0)} onClick={() => void save()}>
            {schedule ? post ? "Save schedule" : "Schedule announcement" : "Confirm and publish"}
          </Button>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
