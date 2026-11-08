"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import type { LecturerQuiz } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { Failure, Paging } from "@/components/challenges/course-challenges";
import { lecturerQuizApi } from "@/lib/lecturer-quiz-api";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { formatQuizWindow, QuizStateBadge } from "./quiz-ui";
import { useMemo, useState } from "react";

export const quizApi = () => lecturerQuizApi(getBrowserSupabase());

function lecturerQuizHref(offering: string, quiz: LecturerQuiz, base: string) {
  if (quiz.state === "draft") return `${base}/${quiz.id}`;
  return `/lecturer/courses/${offering}/quizzes/${quiz.id}`;
}

function lecturerQuizCta(quiz: LecturerQuiz) {
  if (quiz.state === "draft") return "Edit draft";
  if (quiz.state === "open") return "Live results";
  if (quiz.state === "closed") return "View results";
  if (quiz.state === "upcoming") return "Preview";
  return "Manage";
}

export function CourseQuizzes({ offering, lecturer = false }: { offering: string; lecturer?: boolean }) {
  const [offset, setOffset] = useState(0);
  const list = useQuery({ queryKey: ["course-quizzes", offering, offset], queryFn: () => quizApi().list(offering, offset), refetchInterval: lecturer ? 15_000 : false });
  const base = lecturer ? `/lecturer/courses/${offering}/quizzes` : `/courses/${offering}/quizzes`;
  const studentHref = (id: string) => `/course-quizzes/${id}`;

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {list.data ? <p className="text-xs font-semibold text-brand-primary">{list.data.course.code} · {list.data.course.title}</p> : null}
          <h2 className="text-2xl font-bold tracking-tight">Class quizzes</h2>
          <p className="mt-1 text-sm text-ink-muted">Scheduled forms with timer, matric confirmation, and shuffled options.</p>
        </div>
        {lecturer ? (
          <Button asChild className="sm:sticky sm:top-4"><Link href={`${base}/new`}><Plus className="size-4" aria-hidden /> Create quiz</Link></Button>
        ) : null}
      </div>
      <Failure error={list.error} retry={() => void list.refetch()} />
      {list.isPending && <p role="status">Loading quizzes…</p>}
      {!list.data?.items.length && !list.isPending ? (
        lecturer ? (
          <EmptyState
            title="No class quizzes yet"
            description="Create a quiz to replace Google Forms for this course. Set the open/close window, add questions, and publish to enrolled students."
            action={<Button asChild><Link href={`${base}/new`}>Create your first quiz</Link></Button>}
          />
        ) : <p className="text-sm text-ink-muted">Your lecturer has not published a quiz for this course yet.</p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2">{list.data?.items.map(q => (
        <li key={q.id} className="flex min-w-0 flex-col justify-between gap-3 rounded-card border border-line bg-surface-card p-4 break-words">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold">{q.title}</h3>
              <QuizStateBadge state={q.state} />
            </div>
            <p className="text-sm text-ink-muted">{q.question_count} questions · {q.duration_minutes} min per attempt · {q.max_attempts} attempt{q.max_attempts === 1 ? "" : "s"}</p>
            <p className="text-xs text-ink-muted">{formatQuizWindow(q.opens_at, q.closes_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm"><Link href={lecturer ? lecturerQuizHref(offering, q, base) : studentHref(q.id)}>{lecturer ? lecturerQuizCta(q) : q.state === "open" ? "Take quiz" : "Details"}</Link></Button>
            {lecturer && q.state !== "draft" ? (
              <Button asChild variant="outline" size="sm"><Link href={`/course-quizzes/${q.id}`}>Student view</Link></Button>
            ) : null}
          </div>
        </li>
      ))}</ul>
      <Paging offset={offset} hasMore={list.data?.items.length === 20} change={setOffset} />
    </div>
  );
}

export function QuizRoster({ offering, quizId }: { offering: string; quizId: string }) {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const roster = useQuery({ queryKey: ["lecturer-quiz-roster", offering, quizId, search, offset], queryFn: () => quizApi().roster(offering, quizId, search, offset) });

  const stats = useMemo(() => {
    const items = roster.data?.items ?? [];
    const submitted = items.filter(r => r.status === "submitted").length;
    const inProgress = items.filter(r => r.status === "in_progress").length;
    return { submitted, inProgress, total: roster.data?.total ?? items.length };
  }, [roster.data]);

  const duplicateMatrics = useMemo(() => {
    const seen = new Map<string, string[]>();
    for (const r of roster.data?.items ?? []) {
      if (!r.matric_number) continue;
      const key = r.matric_number.trim().toLowerCase();
      seen.set(key, [...(seen.get(key) ?? []), r.name]);
    }
    return [...seen.entries()].filter(([, names]) => names.length > 1);
  }, [roster.data]);

  async function downloadCsv(perQuestion: boolean) {
    const data = await quizApi().exportResults(quizId);
    const qCount = data.questions.length;
    const headers = ["Matric", "Name", "Department", "Score", "Total", "Submitted", ...(perQuestion ? Array.from({ length: qCount }, (_, i) => `Q${i + 1}`) : [])];
    const lines = [headers.join(",")];
    for (const row of data.rows) {
      const base = [row.matric_number, row.name, row.department, row.score ?? "", row.total, row.submitted_at ?? ""];
      const answers = perQuestion
        ? Array.from({ length: qCount }, (_, i) => {
            const idx = row.answers[String(i)];
            if (idx === undefined) return "";
            const opt = data.questions[i]?.options[idx];
            return opt ?? String(idx);
          })
        : [];
      lines.push([...base, ...answers].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.quiz.title.replace(/[^\w.-]+/g, "_")}-results${perQuestion ? "-detailed" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-4" aria-label="Quiz results">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Results</h2>
          <p className="text-sm text-ink-muted">
            {stats.submitted} submitted · {stats.inProgress} in progress · {stats.total} enrolled on this page
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => void downloadCsv(false)}><Download className="size-4" aria-hidden /> Summary CSV</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void downloadCsv(true)}>Detailed CSV</Button>
        </div>
      </div>
      {duplicateMatrics.length ? (
        <p role="status" className="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-sm text-warning">
          Duplicate matric numbers on this page: {duplicateMatrics.map(([m]) => m).join(", ")}. Review before grading.
        </p>
      ) : null}
      <Failure error={roster.error} retry={() => void roster.refetch()} />
      <label className="block max-w-md">Search students<Input value={search} onChange={e => { setSearch(e.target.value); setOffset(0); }} placeholder="Name or matric" /></label>
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b border-line bg-surface-page text-xs font-semibold text-ink-muted">
            <tr>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Matric</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {roster.data?.items.map(r => (
              <tr key={r.user_id} className="hover:bg-surface-tint">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-ink-muted">{r.matric_number ?? "—"}</td>
                <td className="px-3 py-2 text-ink-muted">{r.department ?? "—"}</td>
                <td className="px-3 py-2 capitalize">{r.status.replace("_", " ")}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.score != null ? r.score : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!roster.data?.items.length && !roster.isPending ? <p className="text-sm text-ink-muted">No students match your search.</p> : null}
      <Paging offset={offset} hasMore={roster.data?.items.length === 50} change={setOffset} />
    </section>
  );
}
