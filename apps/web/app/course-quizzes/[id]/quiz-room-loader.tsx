"use client";

import type { LecturerQuizDetail } from "@scholau/api";
import { QuizRoom } from "@/components/lecturer-quizzes/quiz-room";

export function QuizRoomLoader({ id, initialDetail }: { id: string; initialDetail?: LecturerQuizDetail }) {
  return <QuizRoom id={id} initialDetail={initialDetail} />;
}
