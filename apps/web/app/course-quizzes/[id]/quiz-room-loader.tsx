"use client";

import { Suspense } from "react";
import type { LecturerQuizDetail } from "@scholau/api";
import { QuizRoom } from "@/components/lecturer-quizzes/quiz-room";

export function QuizRoomLoader({ id, initialDetail }: { id: string; initialDetail?: LecturerQuizDetail }) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted" role="status">Loading quiz…</p>}>
      <QuizRoom id={id} initialDetail={initialDetail} />
    </Suspense>
  );
}
