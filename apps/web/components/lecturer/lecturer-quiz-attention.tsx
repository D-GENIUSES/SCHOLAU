"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { LecturerOffering, LecturerQuiz } from "@scholau/core";
import { lecturerQuizApi } from "@/lib/lecturer-quiz-api";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { QuizStateBadge } from "@/components/lecturer-quizzes/quiz-ui";

const api = () => lecturerQuizApi(getBrowserSupabase());
const row = "flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface-card px-4 py-3 hover:bg-surface-tint focus-visible:outline-2 focus-visible:outline-brand-primary sm:px-5";

function pickAttention(items: LecturerQuiz[]) {
  const now = Date.now();
  const in24h = now + 86_400_000;
  const drafts = items.filter(q => q.state === "draft");
  const closingSoon = items.filter(q => q.state === "open" && q.closes_at && new Date(q.closes_at).getTime() <= in24h);
  const live = items.filter(q => q.state === "open");
  return { drafts, closingSoon, live };
}

function isQuizRow(value: unknown): value is LecturerQuiz {
  if (!value || typeof value !== "object") return false;
  const q = value as LecturerQuiz;
  return typeof q.id === "string" && typeof q.title === "string" && typeof q.state === "string";
}

export function LecturerQuizAttention({ courses }: { courses: Pick<LecturerOffering, "id" | "code" | "title">[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const slice = courses.slice(0, 12);
  const active = ready && slice.length > 0;
  const queries = useQueries({
    queries: slice.map(c => ({
      queryKey: ["lecturer-quiz-attention", c.id],
      queryFn: () => api().list(c.id, 0),
      staleTime: 60_000,
      retry: 1,
      enabled: active,
    })),
  });
  if (!active) return null;
  const items: Array<{ course: (typeof courses)[number]; quiz: LecturerQuiz }> = [];
  for (let i = 0; i < queries.length; i++) {
    const course = slice[i];
    const data = queries[i]?.data;
    if (!course || !data?.teacher) continue;
    const list = Array.isArray(data.items) ? data.items.filter(isQuizRow) : [];
    const { drafts, closingSoon, live } = pickAttention(list);
    for (const quiz of [...drafts.slice(0, 2), ...closingSoon.slice(0, 2), ...live.filter(q => !closingSoon.includes(q)).slice(0, 1)]) {
      items.push({ course, quiz });
    }
  }
  const unique = items.filter((x, i, a) => a.findIndex(y => y.quiz.id === x.quiz.id) === i).slice(0, 6);
  if (!unique.length) return null;
  return (
    <section aria-labelledby="lecturer-quiz-attention" className="space-y-3">
      <h2 id="lecturer-quiz-attention" className="text-xl font-bold tracking-tight sm:text-2xl">Quizzes</h2>
      <ul className="space-y-2">
        {unique.map(({ course, quiz }) => (
          <li key={quiz.id}>
            <Link href={`/lecturer/courses/${course.id}/quizzes/${quiz.id}`} className={row}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold wrap-break-word">{quiz.title}</p>
                <p className="text-xs text-ink-muted">{course.code} · {course.title}</p>
              </div>
              <QuizStateBadge state={quiz.state} />
              <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
