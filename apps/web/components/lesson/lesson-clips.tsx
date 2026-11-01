"use client";

import { useState, type FormEvent } from "react";
import type { Lesson, LessonVideo } from "@scholau/api";
import { useReviewLessonVideo, useSubmitLessonVideo } from "@scholau/api/react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";

function parseYoutubeId(input: string): string | null {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "m.youtube.com") {
      const watch = url.searchParams.get("v");
      if (watch && /^[A-Za-z0-9_-]{11}$/.test(watch)) return watch;
      const match = url.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
      return match?.[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function clipSrc(video: LessonVideo) {
  const end = video.end_seconds == null ? "" : `&end=${video.end_seconds}`;
  return `https://www.youtube-nocookie.com/embed/${video.youtube_id}?rel=0&start=${video.start_seconds}${end}&autoplay=1`;
}

export function LessonClips({ lesson }: { lesson: Lesson }) {
  const videos = lesson.videos ?? [];
  const pending = lesson.pending_videos ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  if (!videos.length && !pending.length && !lesson.can_manage_videos) return null;

  return (
    <section className="mb-8" aria-labelledby="lesson-clips-heading">
      <h2 id="lesson-clips-heading" className="text-lg font-bold">Clips</h2>
      <p className="mt-1 text-sm text-ink-muted">Lecturer-approved clips for this lesson. A clip loads only after you open it.</p>
      {videos.length ? (
        <ul className="mt-3 flex flex-col gap-3">
          {videos.map((video) => (
            <li key={video.id} className="rounded-control border border-line bg-surface-card p-3">
              {openId === video.id ? (
                <iframe
                  className="aspect-video w-full rounded-control"
                  title={video.title}
                  src={clipSrc(video)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : (
                <Button type="button" variant="outline" onClick={() => setOpenId(video.id)}>
                  Watch: {video.title}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">No approved clips yet.</p>
      )}
      {lesson.can_manage_videos ? <ClipManager lessonId={lesson.lesson_id} pending={pending} /> : null}
    </section>
  );
}

function ClipManager({ lessonId, pending }: { lessonId: string; pending: LessonVideo[] }) {
  const submit = useSubmitLessonVideo(lessonId);
  const review = useReviewLessonVideo(lessonId);
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const youtubeId = parseYoutubeId(link);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const id = parseYoutubeId(link);
    const startSeconds = Number(start);
    const endSeconds = end.trim() === "" ? null : Number(end);
    if (!id) {
      setFormError("Paste a YouTube link or an 11-character video id.");
      return;
    }
    if (!title.trim() || !Number.isInteger(startSeconds) || startSeconds < 0 || (endSeconds !== null && (!Number.isInteger(endSeconds) || endSeconds <= startSeconds))) {
      setFormError("Add a title, a start time in seconds, and an end time after the start if you set one.");
      return;
    }
    setFormError(null);
    submit.mutate(
      { lessonId, youtubeId: id, title: title.trim(), startSeconds, endSeconds },
      { onSuccess: () => { setLink(""); setTitle(""); setStart("0"); setEnd(""); } },
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {pending.length ? (
        <ul className="flex flex-col gap-2" aria-label="Clips waiting for approval">
          {pending.map((video) => (
            <li key={video.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line p-3">
              <span className="text-sm font-semibold">{video.title}</span>
              <span className="flex gap-2">
                <Button type="button" size="sm" disabled={review.isPending} onClick={() => review.mutate({ videoId: video.id, decision: "approved" })}>Approve</Button>
                <Button type="button" size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ videoId: video.id, decision: "rejected" })}>Reject</Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <form className="grid gap-3" onSubmit={onSubmit}>
        <Field id="clip-link" label="YouTube link" hint={youtubeId ? `Video id ${youtubeId}` : "The player uses youtube-nocookie and stays unloaded until a student opens it."}>
          <Input id="clip-link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." maxLength={200} />
        </Field>
        <Field id="clip-title" label="Title">
          <Input id="clip-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="clip-start" label="Start (seconds)">
            <Input id="clip-start" inputMode="numeric" value={start} onChange={(event) => setStart(event.target.value)} />
          </Field>
          <Field id="clip-end" label="End (seconds)" hint="Leave blank to play through.">
            <Input id="clip-end" inputMode="numeric" value={end} onChange={(event) => setEnd(event.target.value)} />
          </Field>
        </div>
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        <InlineError error={submit.error ?? review.error} />
        <Button type="submit" className="self-start" loading={submit.isPending}>Submit clip for approval</Button>
      </form>
    </div>
  );
}
