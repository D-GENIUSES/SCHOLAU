"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { qk } from "@scholau/api";
import { shouldRetry } from "@scholau/api/react";
import type { LecturerQuizList } from "@scholau/api";
import type { LecturerQuiz, LecturerQuizExport, LecturerQuizRosterRow } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { Failure, Paging } from "@/components/challenges/course-challenges";
import { downloadText, toCsv } from "@/components/admin/csv";
import { lecturerQuizApi, type QuizIntegrityFlag } from "@/lib/lecturer-quiz-api";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { formatQuizWindow, QuizStateBadge, studentClassQuizCta } from "./quiz-ui";
import { useMemo, useState } from "react";

const ROSTER_PAGE = 50;

const statusLabels: Record<LecturerQuizRosterRow["status"], string> = {
  submitted: "Submitted",
  in_progress: "In progress",
  not_started: "Not started",
};

const statusTone: Record<LecturerQuizRosterRow["status"], "success" | "brand" | "neutral"> = {
  submitted: "success",
  in_progress: "brand",
  not_started: "neutral",
};

function csvDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function csvSlug(value: string) {
  return value.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "quiz";
}

function buildQuizResultsCsv(data: LecturerQuizExport, perQuestion: boolean): string {
  const qCount = data.questions.length;
  const headers = [
    "Matric",
    "Name",
    "Department",
    "Status",
    "Score",
    "Total",
    "Percent",
    "Submitted at",
    ...(perQuestion
      ? [
          ...Array.from({ length: qCount }, (_, i) => `Q${i + 1}`),
          ...Array.from({ length: qCount }, (_, i) => `Q${i + 1} correct`),
        ]
      : []),
  ];
  const body = data.rows.map((row) => {
    const percent =
      row.score != null && row.total > 0 ? String(Math.round((100 * row.score) / row.total)) : "";
    const base: unknown[] = [
      row.matric_number,
      row.name,
      row.department,
      statusLabels[row.status] ?? row.status,
      row.score ?? "",
      row.total,
      percent,
      csvDateTime(row.submitted_at),
    ];
    if (!perQuestion) return base;
    const answers = Array.from({ length: qCount }, (_, i) => {
      const idx = row.answers[String(i)];
      if (idx === undefined) return "";
      return data.questions[i]?.options[idx] ?? String(idx);
    });
    const correct = Array.from({ length: qCount }, (_, i) => {
      const idx = row.answers[String(i)];
      if (idx === undefined || row.status !== "submitted") return "";
      const expected = data.questions[i]?.correct;
      if (expected == null) return "";
      return idx === expected ? "Y" : "N";
    });
    return [...base, ...answers, ...correct];
  });
  return `\uFEFF${toCsv([headers, ...body])}`;
}

function studentListStale(data: LecturerQuizList | undefined) {
  return !data || data.items.length === 0;
}

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

export function CourseQuizzes({
  offering,
  lecturer = false,
  initialList,
}: {
  offering: string;
  lecturer?: boolean;
  initialList?: LecturerQuizList;
}) {
  const [offset, setOffset] = useState(0);
  const seededEmpty = offset === 0 && initialList != null && initialList.items.length === 0;
  const list = useQuery({
    queryKey: [...qk.classQuizzes(), offering, offset],
    initialData: offset === 0 ? initialList : undefined,
    queryFn: () => quizApi().list(offering, offset),
    retry: shouldRetry,
    // Keep empty student lists soft so a just-published quiz appears without a hard refresh.
    staleTime: lecturer ? 0 : seededEmpty ? 0 : initialList ? 60_000 : 30_000,
    refetchOnMount: (query) => {
      if (lecturer) return "always";
      if (seededEmpty) return "always";
      if (initialList && offset === 0) return false;
      return studentListStale(query.state.data as LecturerQuizList | undefined);
    },
    refetchOnWindowFocus: true,
    refetchInterval: lecturer
      ? 15_000
      : (query) => (studentListStale(query.state.data as LecturerQuizList | undefined) ? 20_000 : false),
  });
  const base = lecturer ? `/lecturer/courses/${offering}/quizzes` : `/courses/${offering}/quizzes`;
  const studentHref = (id: string) => `/course-quizzes/${id}`;

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {lecturer ? (
            <p className="text-sm text-ink-muted">Timed class quizzes with live results.</p>
          ) : (
            <>
              {list.data?.course ? <p className="text-xs font-semibold text-brand-primary">{list.data.course.code} · {list.data.course.title}</p> : null}
              <h2 className="text-xl font-bold tracking-tight sm:text-[1.35rem]">Class quizzes</h2>
              <p className="mt-0.5 text-xs text-ink-muted sm:text-sm">Scheduled forms with timer and shuffled options.</p>
            </>
          )}
        </div>
        {lecturer ? (
          <Button asChild size="sm"><Link href={`${base}/new`}><Plus className="size-4" aria-hidden /> Create</Link></Button>
        ) : null}
      </div>
      <Failure error={list.error} retry={() => void list.refetch()} />
      {list.isPending && <p role="status">Loading quizzes…</p>}
      {list.isSuccess && !list.data.items.length ? (
        lecturer ? (
          <EmptyState
            title="No class quizzes yet"
            description="Create a quiz to replace Google Forms for this course. Set the open/close window, add questions, and publish to enrolled students."
            action={<Button asChild><Link href={`${base}/new`}>Create your first quiz</Link></Button>}
          />
        ) : <p className="text-sm text-ink-muted">Your lecturer has not published a quiz for this course yet.</p>
      ) : null}
      <ul className={lecturer ? "divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-card" : "grid gap-3 sm:grid-cols-2"}>
        {list.data?.items.map(q => (
          <li key={q.id} className={lecturer
            ? "flex min-w-0 flex-wrap items-center justify-between gap-2 px-3.5 py-3 break-words"
            : "flex min-w-0 flex-col justify-between gap-3 rounded-card border border-line bg-surface-card p-4 break-words"}>
            <div className={lecturer ? "min-w-0 space-y-0.5" : "space-y-2"}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={lecturer ? "text-sm font-semibold" : "font-bold"}>{q.title}</h3>
                <QuizStateBadge state={q.state} />
              </div>
              <p className="text-xs text-ink-muted">{q.question_count} questions · {q.duration_minutes} min · {q.max_attempts} attempt{q.max_attempts === 1 ? "" : "s"} · {formatQuizWindow(q.opens_at, q.closes_at)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm"><Link href={lecturer ? lecturerQuizHref(offering, q, base) : studentHref(q.id)}>{lecturer ? lecturerQuizCta(q) : studentClassQuizCta(q.state)}</Link></Button>
              {lecturer && q.state !== "draft" ? (
                <Button asChild variant="outline" size="sm"><Link href={`/course-quizzes/${q.id}`}>Student view</Link></Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Paging offset={offset} hasMore={list.data?.items.length === 20} change={setOffset} />
    </div>
  );
}

const integrityLabels: Record<QuizIntegrityFlag["kind"], string> = {
  app_hidden: "Left quiz tab",
  focus_lost: "Window lost focus",
  possible_split_screen: "Possible split screen",
  fullscreen_exit: "Exited full screen",
  screenshot_shortcut: "Screenshot shortcut",
  recording_shortcut: "Screen recording shortcut",
  casting_shortcut: "Screen casting shortcut",
};

function RosterFlags({
  flags,
  loading,
  unavailable,
}: {
  flags: QuizIntegrityFlag[];
  loading: boolean;
  unavailable: boolean;
}) {
  const total = flags.reduce((n, flag) => n + flag.count, 0);
  if (total > 0) {
    return (
      <details className="min-w-0">
        <summary className="cursor-pointer whitespace-nowrap text-xs font-semibold text-warning">{total}</summary>
        <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-ink-muted">
          {flags.map((flag) => (
            <li key={`${flag.attempt_number}:${flag.kind}`}>
              Attempt {flag.attempt_number} · {integrityLabels[flag.kind]} ×{flag.count}
            </li>
          ))}
        </ul>
      </details>
    );
  }
  return (
    <span className="text-xs text-ink-muted">
      {unavailable ? "—" : loading ? "…" : "—"}
    </span>
  );
}

function RosterScore({ score, total }: { score: number | null; total: number }) {
  if (score == null) return <span className="tabular-nums text-ink-muted">—</span>;
  return <span className="tabular-nums">{score}/{total}</span>;
}

export function QuizRoster({ offering, quizId }: { offering: string; quizId: string }) {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [csvBusy, setCsvBusy] = useState(false);
  const roster = useQuery({
    queryKey: ["lecturer-quiz-roster", offering, quizId, search, offset],
    queryFn: () => quizApi().roster(offering, quizId, search, offset),
  });

  const students = roster.data?.items.map(({ user_id }) => user_id) ?? [];
  const questionTotal = roster.data?.quiz.question_count ?? 0;
  const integrity = useQuery({
    queryKey: ["lecturer-quiz-integrity", quizId, students],
    queryFn: () => quizApi().integrity(quizId, students),
    enabled: students.length > 0,
  });
  const flagsByStudent = useMemo(() => {
    const grouped = new Map<string, QuizIntegrityFlag[]>();
    for (const flag of integrity.data?.items ?? []) {
      const existing = grouped.get(flag.user_id);
      if (existing) existing.push(flag);
      else grouped.set(flag.user_id, [flag]);
    }
    return grouped;
  }, [integrity.data]);

  const stats = useMemo(() => {
    const items = roster.data?.items ?? [];
    const submitted = items.filter((r) => r.status === "submitted").length;
    const inProgress = items.filter((r) => r.status === "in_progress").length;
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
    if (csvBusy) return;
    setCsvBusy(true);
    try {
      const data = await quizApi().exportResults(quizId);
      const titleSlug = csvSlug(data.quiz.title);
      downloadText(
        `${titleSlug}_results${perQuestion ? "_detailed" : ""}.csv`,
        buildQuizResultsCsv(data, perQuestion),
      );
    } finally {
      setCsvBusy(false);
    }
  }

  return (
    <section className="space-y-3" aria-label="Quiz results">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">Results</h2>
          <p className="text-xs text-ink-muted">
            {stats.submitted} submitted · {stats.inProgress} live · {stats.total} enrolled
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!students.length || integrity.isFetching}
            onClick={() => void integrity.refetch()}
          >
            Flags
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={csvBusy} onClick={() => void downloadCsv(false)}>
            <Download className="size-3.5" aria-hidden /> CSV
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={csvBusy} onClick={() => void downloadCsv(true)}>
            Detailed
          </Button>
        </div>
      </div>

      {duplicateMatrics.length ? (
        <p role="status" className="rounded-lg border border-warning bg-warning-bg px-2.5 py-1.5 text-xs text-warning">
          Duplicate matric numbers on this page: {duplicateMatrics.map(([m]) => m).join(", ")}.
        </p>
      ) : null}
      <Failure error={roster.error} retry={() => void roster.refetch()} />

      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <label className="min-w-0 flex-1 text-xs font-medium text-ink-muted">
          <span className="sr-only">Search students</span>
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            placeholder="Search name or matric"
            className="h-9"
          />
        </label>
        <p className="text-[11px] leading-snug text-ink-muted sm:max-w-[14rem]">
          Flags are browser signals for review — they do not change scores.
        </p>
      </div>
      {integrity.isError ? (
        <p className="text-xs text-danger" role="status">
          Flags unavailable.{" "}
          <Button variant="link" onClick={() => void integrity.refetch()}>
            Retry
          </Button>
        </p>
      ) : null}

      {/* Mobile: dense stacked rows */}
      <ul className="divide-y divide-line border-y border-line md:hidden">
        {roster.data?.items.map((r) => {
          const flags = flagsByStudent.get(r.user_id) ?? [];
          const meta = [r.matric_number, r.department].filter(Boolean).join(" · ");
          return (
            <li key={r.user_id} className="py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium">{r.name}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={statusTone[r.status]} className="px-1.5 py-0">
                    {statusLabels[r.status]}
                  </Badge>
                  <span className="text-sm">
                    <RosterScore score={r.score} total={questionTotal} />
                  </span>
                </div>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-ink-muted">
                <p className="min-w-0 truncate">{meta || "—"}</p>
                <RosterFlags flags={flags} loading={integrity.isPending} unavailable={integrity.isError} />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop: slim table */}
      <div className="hidden overflow-x-auto rounded-card border border-line md:block">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-line bg-surface-page text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-2.5 py-1.5 font-semibold">Student</th>
              <th className="px-2.5 py-1.5 font-semibold">Matric</th>
              <th className="px-2.5 py-1.5 font-semibold">Dept</th>
              <th className="px-2.5 py-1.5 font-semibold">Status</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">Score</th>
              <th className="px-2.5 py-1.5 font-semibold">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {roster.data?.items.map((r) => {
              const flags = flagsByStudent.get(r.user_id) ?? [];
              return (
                <tr key={r.user_id} className="hover:bg-surface-tint">
                  <td className="max-w-[12rem] truncate px-2.5 py-1.5 font-medium">{r.name}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-ink-muted">{r.matric_number ?? "—"}</td>
                  <td className="max-w-[9rem] truncate px-2.5 py-1.5 text-ink-muted">{r.department ?? "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5">
                    <Badge tone={statusTone[r.status]} className="px-1.5 py-0">
                      {statusLabels[r.status]}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-right">
                    <RosterScore score={r.score} total={questionTotal} />
                  </td>
                  <td className="px-2.5 py-1.5">
                    <RosterFlags flags={flags} loading={integrity.isPending} unavailable={integrity.isError} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!roster.data?.items.length && !roster.isPending ? (
        <p className="text-xs text-ink-muted">No students match your search.</p>
      ) : null}
      {roster.isPending ? <p className="text-xs text-ink-muted" role="status">Loading…</p> : null}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - ROSTER_PAGE))}
        >
          Prev
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={roster.data?.items.length !== ROSTER_PAGE}
          onClick={() => setOffset(offset + ROSTER_PAGE)}
        >
          Next
        </Button>
        {stats.total > 0 ? (
          <span className="text-ink-muted">
            {offset + 1}–{offset + (roster.data?.items.length ?? 0)} of {stats.total}
          </span>
        ) : null}
      </div>
    </section>
  );
}
