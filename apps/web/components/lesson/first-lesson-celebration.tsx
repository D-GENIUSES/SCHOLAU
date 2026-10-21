"use client";

import { Flame } from "lucide-react";
import { useEffect, useState } from "react";

export const FIRST_LESSON_CELEBRATION_MS = 3200;

/** Brief, non-blocking feedback after the server confirms a learner's first lesson. */
export function FirstLessonCelebration({ days, firstLesson = true }: { days: number; firstLesson?: boolean }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), FIRST_LESSON_CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div className="first-lesson-celebration" role="status" aria-live="polite" aria-atomic="true">
      <span className="first-lesson-fire" aria-hidden="true">
        <span className="first-lesson-spark spark-one" />
        <span className="first-lesson-spark spark-two" />
        <span className="first-lesson-spark spark-three" />
        <Flame className="size-9" fill="currentColor" strokeWidth={1.5} />
      </span>
      <span><strong>{firstLesson ? "First lesson complete!" : `${days}-day streak!`}</strong><small>{days === 1 ? "Your 1-day streak starts now." : firstLesson ? `${days}-day streak. Keep it going!` : "Another day of learning. Keep it going!"}</small></span>
    </div>
  );
}
