"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

type Report = {
  topics: {
    course_code: string;
    topic_key: string;
    topic_title: string;
    pre_score: number | null;
    pre_total: number | null;
    post_score: number | null;
    post_total: number | null;
    gain: number | null;
  }[];
};

export default function MyTopicGapsPage() {
  const report = useQuery({
    queryKey: ["my-topic-gaps"],
    queryFn: async () => {
      const { data, error } = await getBrowserSupabase().rpc("get_my_topic_gap_report_v1");
      if (error) throw error;
      return data as Report;
    },
  });
  if (report.isPending) return <LoadingState label="Loading your topic gaps…" />;
  if (report.isError) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;
  if (!report.data.topics.length) {
    return <EmptyState title="No topic checks yet" description="Take a pre-test and post-test on a course topic. Results here compare those two short practice checks." action={<Link href="/courses">Browse course samples</Link>} />;
  }
  return (
    <section>
      <h1>Topic gaps</h1>
      <p>Each row is your pre-test and post-test for one topic. The gain is post-test correct answers minus pre-test correct answers.</p>
      <ul>
        {report.data.topics.map((topic) => (
          <li key={`${topic.course_code}-${topic.topic_key}`}>
            <strong>{topic.course_code} · {topic.topic_title}</strong>
            <p>Pre {topic.pre_score ?? "—"}/{topic.pre_total ?? "—"}. Post {topic.post_score ?? "—"}/{topic.post_total ?? "—"}. Gain {topic.gain ?? "—"}.</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
