"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Failure, Paging } from "@/components/challenges/course-challenges";
import { lecturerQuizApi } from "@/lib/lecturer-quiz-api";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useState } from "react";

export const quizApi = () => lecturerQuizApi(getBrowserSupabase());

export function CourseQuizzes({ offering, lecturer = false }: { offering: string; lecturer?: boolean }) {
  const [offset, setOffset] = useState(0);
  const list = useQuery({ queryKey: ["course-quizzes", offering, offset], queryFn: () => quizApi().list(offering, offset) });
  const base = lecturer ? `/lecturer/courses/${offering}/quizzes` : `/courses/${offering}/quizzes`;
  return <div className="space-y-4 min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Course quizzes</h2>
      {lecturer && <Button asChild><Link href={`${base}/new`}>Create quiz</Link></Button>}
    </div>
    <Failure error={list.error} retry={() => void list.refetch()} />
    {list.isPending && <p role="status">Loading quizzes…</p>}
    <ul className="space-y-3">{list.data?.items.map(q => (
      <li key={q.id} className="rounded-xl border border-line p-4 flex flex-wrap justify-between gap-3 items-center">
        <div>
          <p className="font-semibold">{q.title}</p>
          <p className="text-sm text-ink-muted capitalize">{q.state} · {q.question_count} questions · {q.duration_minutes} min per attempt</p>
          {q.opens_at && q.closes_at ? <p className="text-sm text-ink-muted">{new Date(q.opens_at).toLocaleString()} – {new Date(q.closes_at).toLocaleString()}</p> : null}
        </div>
        <Button asChild variant="secondary"><Link href={lecturer && q.state === "draft" ? `${base}/${q.id}` : `/course-quizzes/${q.id}`}>{lecturer ? "Manage" : "Open"}</Link></Button>
      </li>
    ))}</ul>
    {!list.data?.items.length && !list.isPending ? <p>No quizzes yet.</p> : null}
    <Paging offset={offset} hasMore={list.data?.items.length === 20} change={setOffset} />
  </div>;
}

export function QuizRoster({ offering, quizId }: { offering: string; quizId: string }) {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const roster = useQuery({ queryKey: ["lecturer-quiz-roster", offering, quizId, search, offset], queryFn: () => quizApi().roster(offering, quizId, search, offset) });
  async function downloadCsv() {
    const data = await quizApi().exportResults(quizId);
    const headers = ["Matric", "Name", "Department", "Score", "Total", "Submitted"];
    const lines = [headers.join(",")];
    for (const row of data.rows) {
      lines.push([row.matric_number, row.name, row.department, row.score ?? "", row.total, row.submitted_at ?? ""].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${data.quiz.title.replace(/[^\w.-]+/g, "_")}-results.csv`; a.click();
    URL.revokeObjectURL(url);
  }
  return <section className="space-y-3" aria-label="Quiz results">
    <Failure error={roster.error} retry={() => void roster.refetch()} />
    <div className="flex flex-wrap gap-2 items-end">
      <label className="block flex-1 min-w-[12rem]">Search<Input value={search} onChange={e => { setSearch(e.target.value); setOffset(0); }} /></label>
      <Button type="button" variant="secondary" onClick={() => void downloadCsv()}>Download CSV</Button>
    </div>
  <ul className="divide-y divide-line">{roster.data?.items.map(r => (
      <li key={r.user_id} className="py-3 flex flex-wrap justify-between gap-2 text-sm">
        <span>{r.name}{r.matric_number ? ` · ${r.matric_number}` : ""}</span>
        <span className="capitalize">{r.status}{r.score != null ? ` · ${r.score}` : ""}</span>
      </li>
    ))}</ul>
    <Paging offset={offset} hasMore={roster.data?.items.length === 50} change={setOffset} />
  </section>;
}
