"use client";

import { useState } from "react";
import type { Lesson, LessonVideo } from "@scholau/api";
import { useReviewLessonVideo } from "@scholau/api/react";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";
import { curatedVideosForLesson } from "./curated-video-library";

function clipSrc(video: LessonVideo) {
  const end = video.end_seconds == null ? "" : `&end=${video.end_seconds}`;
  return `https://www.youtube-nocookie.com/embed/${video.youtube_id}?rel=0&start=${video.start_seconds}${end}&autoplay=1`;
}

export function LessonClips({ lesson, embedded = false }: { lesson: Lesson; embedded?: boolean }) {
  const approved = lesson.videos ?? [];
  const curated = curatedVideosForLesson(lesson.title);
  const videos = [...approved, ...curated.filter((v) => !approved.some((existing) => existing.youtube_id === v.youtube_id))];
  const pending = lesson.pending_videos ?? [];
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className={embedded ? undefined : "mb-8"} aria-labelledby={embedded ? undefined : "lesson-clips-heading"}>
      {embedded ? null : (
        <>
          <h2 id="lesson-clips-heading" className="text-lg font-bold">Video lessons</h2>
          <p className="mt-1 text-sm text-ink-muted">Videos are matched to this lesson from published educational sources or approved suggestions. YouTube loads only when you choose to watch.</p>
        </>
      )}
      {videos.length ? (
        <ul className={embedded ? "flex flex-col gap-3" : "mt-3 flex flex-col gap-3"}>
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
                  Watch video: {video.title}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={embedded ? "text-sm text-ink-muted" : "mt-3 text-sm text-ink-muted"}>No reviewed video available yet. You can continue with the written lesson and worked examples.</p>
      )}
      {lesson.can_manage_videos ? <ClipManager lessonId={lesson.lesson_id} pending={pending} /> : null}
    </section>
  );
}

function ClipManager({ lessonId, pending }: { lessonId: string; pending: LessonVideo[] }) {
  const review = useReviewLessonVideo(lessonId);

  return (
    <div className="mt-4 flex flex-col gap-4">
      {pending.length ? (
        <ul className="flex flex-col gap-2" aria-label="Video suggestions waiting for approval">
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
      <InlineError error={review.error} />
    </div>
  );
}
