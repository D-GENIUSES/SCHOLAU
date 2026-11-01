"use client";

import Link from "next/link";
import type { LearningTopicInsight } from "@scholau/api";
import { useLearningInsights } from "@scholau/api/react";
import { ErrorState, LoadingState } from "@/components/ui/states";

export function LearningInsights() {
  const insights = useLearningInsights();
  if (insights.isPending) return <LoadingState label="Loading your results…" />;
  if (insights.isError) return <ErrorState error={insights.error} onRetry={() => void insights.refetch()} />;
  const { strengths, weaknesses } = insights.data;
  if (!strengths.length && !weaknesses.length) {
    return (
      <section className="mt-6" aria-labelledby="insights-heading">
        <h2 id="insights-heading" className="text-lg font-bold">Strengths and weaknesses</h2>
        <p className="mt-2 text-sm text-ink-muted">Answer at least three questions in a lesson to see where you are strong and where to revise.</p>
      </section>
    );
  }
  return (
    <section className="mt-6 grid gap-4 sm:grid-cols-2" aria-labelledby="insights-heading">
      <h2 id="insights-heading" className="sr-only">Strengths and weaknesses</h2>
      <TopicList title="Strengths" empty="No strong topics yet. Keep practising." topics={strengths} />
      <TopicList title="Needs work" empty="No weak topics yet." topics={weaknesses} />
    </section>
  );
}

function TopicList({ title, empty, topics }: { title: string; empty: string; topics: LearningTopicInsight[] }) {
  return (
    <div className="rounded-card border border-line bg-surface-card p-4">
      <h3 className="font-bold">{title}</h3>
      {topics.length ? (
        <ul className="mt-3 flex flex-col gap-3">
          {topics.map((topic) => (
            <li key={`${topic.lesson_id ?? topic.course_code}-${topic.title}`}>
              {topic.lesson_id ? (
                <Link href={`/study/lessons/${topic.lesson_id}`} className="font-semibold text-brand-primary hover:underline">{topic.title}</Link>
              ) : (
                <span className="font-semibold">{topic.title}</span>
              )}
              <p className="text-sm text-ink-muted">{topic.course_code} · {topic.correct} of {topic.answered} correct · {topic.accuracy}%</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">{empty}</p>
      )}
    </div>
  );
}
