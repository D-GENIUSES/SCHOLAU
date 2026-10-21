"use client";

import { Check, Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import "./streak-celebration.css";

export const FIRST_LESSON_CELEBRATION_MS = 1800;

/** Presentation only; receives a server-confirmed streak increase. */
export function FirstLessonCelebration({ days, localDate, previousDays = Math.max(0, days - 1) }: { days: number; localDate: string; previousDays?: number }) {
  const [open, setOpen] = useState(true);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = reduced ? [setTimeout(() => setStage(3), 0)] : [setTimeout(() => setStage(1), 450), setTimeout(() => setStage(2), 950), setTimeout(() => setStage(3), 1450)];
    return () => timers.forEach(clearTimeout);
  }, []);
  const weekday = (new Date(`${localDate}T12:00:00Z`).getUTCDay() + 6) % 7;
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent hideClose className="streak-celebration" data-stage={stage}>
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary">Lesson complete</p>
      <div className="streak-ignite" aria-hidden="true"><span className="streak-halo" /><Flame fill="currentColor" strokeWidth={1.4} /><span className="streak-ember ember-one" /><span className="streak-ember ember-two" /><span className="streak-ember ember-three" /></div>
      <DialogTitle className="!p-0 !text-center"><span className="sr-only">{days} day streak</span><span aria-hidden="true" className="streak-big-count" key={stage >= 2 ? "new" : "old"}>{stage >= 2 ? days : previousDays}</span><span aria-hidden="true" className="block text-lg font-semibold text-brand-primary">{days === 1 ? "day streak" : "days streak"}</span></DialogTitle>
      <DialogDescription className="text-center">{days === 1 ? "Your streak starts today." : "Another day of progress. Keep it going!"}</DialogDescription>
      <ol className="streak-week" aria-label="This week's streak">
        {labels.map((label, index) => {
          const offset = weekday - index;
          const earned = offset >= 0 && offset < days;
          const checked = earned && (index !== weekday || stage >= 3);
          return <li key={names[index]} aria-label={`${names[index]}${index === weekday ? ", today" : ""}: ${earned ? "completed" : index > weekday ? "upcoming" : "not in current streak"}`} aria-current={index === weekday ? "date" : undefined}>
            <span>{label}</span><span className="streak-day" data-complete={checked}>{checked ? <Check size={17} strokeWidth={3} aria-hidden /> : <span className="size-1 rounded-full bg-current" />}</span>
          </li>;
        })}
      </ol>
      <p className="text-center text-xs text-ink-muted">A little learning every day adds up.</p>
      <Button className="w-full" onClick={() => setOpen(false)}>Continue</Button>
    </DialogContent>
  </Dialog>;
}
