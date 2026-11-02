"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminPageHeader } from "@/components/admin/shared";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

type Aggregate = {
  minimum_students: number;
  suppressed_cells: number;
  rows: {
    department: string;
    course_code: string;
    topic_key: string;
    topic_title: string;
    students: number;
    pre_mean_percent: number;
    post_mean_percent: number;
    mean_gain_percent: number;
  }[];
};

export default function TopicGapAdminPage() {
  const report = useQuery({
    queryKey: ["topic-gap-aggregate"],
    queryFn: async () => {
      const { data, error } = await getBrowserSupabase().rpc("get_topic_gap_aggregate_v1");
      if (error) throw error;
      return data as Aggregate;
    },
  });
  if (report.isPending) return <LoadingState label="Loading topic gaps…" />;
  if (report.isError) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;
  const data = report.data;
  return (
    <>
      <AdminPageHeader title="Topic gaps" description="Anonymised pre-test and post-test means. Cells with fewer than five students are hidden." />
      <p className="text-sm text-ink-muted">{data.suppressed_cells} small department cells are hidden so individual students cannot be identified.</p>
      {data.rows.length === 0 ? <EmptyState title="No aggregate yet" description="Means appear after at least five students in a department finish both checks for a topic." /> : (
        <table className="w-full text-sm">
          <caption className="sr-only">Department topic gap means</caption>
          <thead><tr><th>Department</th><th>Course</th><th>Topic</th><th>Students</th><th>Pre</th><th>Post</th><th>Gain</th></tr></thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={`${row.department}-${row.course_code}-${row.topic_key}`}>
                <td>{row.department}</td><td>{row.course_code}</td><td>{row.topic_title}</td><td>{row.students}</td>
                <td>{row.pre_mean_percent}%</td><td>{row.post_mean_percent}%</td><td>{row.mean_gain_percent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
