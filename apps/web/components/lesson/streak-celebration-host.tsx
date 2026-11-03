"use client";

import { useEffect, useState } from "react";
import { subscribeStreakCelebration, type StreakCelebrationPayload } from "@/lib/streak-celebration-bus";
import { playStreakExtendedSound } from "@/lib/feedback-sounds";
import { FirstLessonCelebration } from "./first-lesson-celebration";

export function StreakCelebrationHost() {
  const [active, setActive] = useState<StreakCelebrationPayload | null>(null);

  useEffect(() => subscribeStreakCelebration((payload) => setActive(payload)), []);

  useEffect(() => {
    if (active) playStreakExtendedSound();
  }, [active]);

  if (!active) return null;
  return (
    <FirstLessonCelebration
      key={active.localDate}
      days={active.days}
      localDate={active.localDate}
      previousDays={active.previousDays}
      onClose={() => setActive(null)}
    />
  );
}
