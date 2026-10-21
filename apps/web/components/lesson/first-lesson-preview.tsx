"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { HomeSummary, ScholauApi } from "@scholau/api";
import { ScholauApiProvider, useCompleteLesson, useHomeSummary } from "@scholau/api/react";
import { ShellFrame } from "@/components/shell/shell-frame";
import { StatsPanel } from "@/components/home/side-panels";
import { Button } from "@/components/ui/button";
import { FirstLessonCelebration, FIRST_LESSON_CELEBRATION_MS } from "./first-lesson-celebration";

/** Development-only, isolated API fixture. Never calls the connected database. */
export function FirstLessonPreview() {
  const [client] = useState(() => new QueryClient());
  const [api] = useState(() => {
    let completed = false;
    const stamp = new Date().toISOString();
    const streak = () => ({ current: completed ? 1 : 0, longest: completed ? 1 : 0, active_today: completed, local_date: stamp.slice(0, 10) });
    const summary = (): HomeSummary => ({ server_time: stamp, display_name: "New learner", needs_onboarding: false,
      xp_total: 10, learning_xp_today: 0, learning_xp_daily_cap: null, premium: false, streak: streak(),
      continue_learning: null, enrolled_courses: [], recent_activity: [], live_battle: null, unread_notifications: 0 });
    return {
      getHomeSummary: async () => summary(),
      completeLesson: async () => {
        const already = completed;
        completed = true;
        return { server_time: stamp, lesson_id: "preview-lesson", state: "completed", completed_at: stamp,
          already_completed: already, first_lesson_completed: !already, xp_awarded: 0, xp_capped: false, xp_total: 10, streak: streak() };
      },
    } as unknown as ScholauApi;
  });
  return <QueryClientProvider client={client}><ScholauApiProvider api={api}><PreviewLesson /></ScholauApiProvider></QueryClientProvider>;
}

function PreviewLesson() {
  const { data } = useHomeSummary();
  const complete = useCompleteLesson({ firstLessonCelebrationMs: FIRST_LESSON_CELEBRATION_MS });
  return <ShellFrame pathname="/study" displayName="New learner" streak={data?.streak}>
    {complete.data?.first_lesson_completed && !complete.data.already_completed ? <FirstLessonCelebration days={complete.data.streak.current} localDate={complete.data.streak.local_date} /> : null}
    <div className="mx-auto flex max-w-reading flex-col gap-6">
      <p className="text-xs text-ink-muted">Development preview · sample data · no account progress is changed.</p>
      <div><h1 className="text-2xl font-bold tracking-tight">Your first lesson</h1><p className="mt-2 text-sm text-ink-muted">Complete this sample to see the fire animation, followed by your updated streak.</p></div>
      {data ? <StatsPanel summary={data} /> : null}
      <section className="rounded-card border border-line bg-surface-card p-5"><h2 className="font-semibold">A little progress, every day</h2><p className="my-4 text-sm leading-relaxed text-ink-muted">One completed lesson starts your learning streak. Come back tomorrow to keep it going.</p>
        <Button onClick={() => complete.mutate({ lessonVersionId: "preview-version" })} loading={complete.isPending}>{complete.data ? "Complete again" : "Mark as complete"}</Button>
        {complete.data ? <p role="status" className="mt-3 text-sm text-success">{complete.data.already_completed ? "Already completed. Your streak stays the same." : "Lesson complete."}</p> : null}
      </section>
    </div>
  </ShellFrame>;
}
