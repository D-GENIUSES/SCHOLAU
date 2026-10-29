"use client";

import { Check } from "lucide-react";
import { StreakFlame } from "@/components/icons/streak-flame";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import "./streak-celebration.css";

export const FIRST_LESSON_CELEBRATION_MS = 2500;

/** Presentation only; receives a server-confirmed streak increase. */
export function FirstLessonCelebration({ days, localDate, previousDays = Math.max(0, days - 1) }: { days: number; localDate: string; previousDays?: number }) {
  const [open, setOpen] = useState(true);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = reduced ? [setTimeout(() => setStage(4), 0)] : [
      setTimeout(() => setStage(1), 300),
      setTimeout(() => setStage(2), 850),
      setTimeout(() => setStage(3), 1450),
      setTimeout(() => setStage(4), 1950),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  const weekday = (new Date(`${localDate}T12:00:00Z`).getUTCDay() + 6) % 7;
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent hideClose className="streak-celebration" data-stage={stage}>
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary">Daily progress</p>
      <div className="streak-ignite" aria-hidden="true"><span className="streak-halo" /><StreakFlame active={stage >= 1} tone="blue" size={104} /><span className="streak-ember ember-one" /><span className="streak-ember ember-two" /><span className="streak-ember ember-three" /></div>
      <ol className="streak-week" aria-label="This week's streak">
        {labels.map((label, index) => {
          const offset = weekday - index;
          const earned = offset >= 0 && offset < days;
          const checked = earned && (index !== weekday || stage >= 3);
          return <li key={names[index]} aria-label={`${names[index]}${index === weekday ? ", today" : ""}: ${earned ? "completed" : index > weekday ? "upcoming" : "not in current streak"}`} aria-current={index === weekday ? "date" : undefined} data-reveal={index === weekday && stage >= 3}>
            <span>{label}</span><span className="streak-day" data-complete={checked}>{checked ? <Check size={17} strokeWidth={3} aria-hidden /> : <span className="size-1 rounded-full bg-current" />}</span>
          </li>;
        })}
      </ol>
      <DialogTitle className="!p-0 !text-center"><span className="sr-only">{days} day streak</span><span aria-hidden="true" className="streak-big-count" key={stage >= 2 ? "new" : "old"}>{stage >= 2 ? days : previousDays}</span><span aria-hidden="true" className="streak-info-message block text-lg font-semibold text-brand-primary">{days === 1 ? "You’ve started a streak!" : `${days}-day streak!`}</span></DialogTitle>
      <DialogDescription className="streak-info-message text-center">{days === 1 ? "Study again tomorrow to build your streak." : "You studied today. Keep it going tomorrow."}</DialogDescription>
      <Button className="w-full" disabled={stage < 4} onClick={() => setOpen(false)}>Continue</Button>
    </DialogContent>
  </Dialog>;
}
