"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ChallengeDetail, ChallengeRosterRow } from "@scholau/core";
import { challengeApi, challengeError } from "@/lib/challenge-api";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { MathText } from "@/components/math/math-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const api = () => challengeApi(getBrowserSupabase());

export function Failure({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-control border border-danger p-3 text-sm">
      <p>{challengeError(error)}</p>
      {retry ? <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={retry}>Retry / refresh</Button> : null}
    </div>
  );
}

export function Paging({ offset, hasMore, change }: { offset: number; hasMore: boolean; change: (offset: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" size="sm" disabled={!offset} onClick={() => change(Math.max(0, offset - 20))}>Previous</Button>
      <Button type="button" variant="secondary" size="sm" disabled={!hasMore} onClick={() => change(offset + 20)}>Next</Button>
    </div>
  );
}

function statusLabel(r: ChallengeRosterRow, challenge: string | null) {
  if (!challenge) return "Enrolled";
  if (r.status === "not_participated") return "Did not participate";
  if (r.status === "submitted") return "Submitted";
  return "Participating";
}

export function CourseChallenges({ offering, workspace = false }: { offering: string; workspace?: boolean }) {
  const [offset, setOffset] = useState(0);
  const query = useQuery({ staleTime: 0, queryKey: ["course-challenges", offering, offset], queryFn: () => api().list(offering, offset), refetchInterval: 15000 });
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!workspace ? <h1 className="text-lg font-bold tracking-tight sm:text-xl">Course challenges</h1> : <p className="text-sm font-semibold text-ink">Challenges</p>}
        {query.data?.teacher ? (
          <Button asChild size="sm"><Link href={`/lecturer/courses/${offering}/challenges/new`}>Create</Link></Button>
        ) : null}
      </div>
      <Failure error={query.error} retry={() => void query.refetch()} />
      {query.isPending ? <p role="status" className="text-sm text-ink-muted">Loading challenges…</p> : null}
      {query.data ? (
        <>
          {!workspace ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <p className="text-ink-muted">{query.data.course.code} · {query.data.course.title}</p>
              <Link
                className="inline-flex min-h-9 items-center text-sm font-semibold text-brand-primary underline-offset-2 hover:underline"
                href={query.data.teacher ? `/lecturer/courses/${offering}/content` : `/study/courses/${offering}`}
              >
                Back to course
              </Link>
              {query.data.teacher ? (
                <Link className="inline-flex min-h-9 items-center text-sm font-semibold text-ink-muted underline-offset-2 hover:underline" href={`/lecturer/courses/${offering}/students`}>
                  Students
                </Link>
              ) : null}
            </div>
          ) : null}
          {!query.data.items.length ? <p className="text-sm text-ink-muted">No challenges on this page.</p> : null}
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-card">
            {query.data.items.map((c) => (
              <li key={c.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3.5 py-3 break-words sm:px-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{c.title}</p>
                  <p className="mt-0.5 text-xs capitalize text-ink-muted">{c.state} · {c.question_count} questions · {c.duration_minutes} min</p>
                  <p className="text-xs text-ink-muted">{c.starts_at ? new Date(c.starts_at).toLocaleString() : "Unpublished draft"}</p>
                </div>
                <Button asChild variant="secondary" size="sm"><Link href={`/challenges/${c.id}`}>Open</Link></Button>
              </li>
            ))}
          </ul>
          <Paging offset={offset} hasMore={query.data.items.length === 20} change={setOffset} />
        </>
      ) : null}
    </section>
  );
}

export function QuestionReview({ detail }: { detail: ChallengeDetail }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Score: {detail.attempt?.score ?? 0}/{detail.challenge.question_count}</p>
      {detail.questions.map((q, i) => (
        <article key={i} className="rounded-control border border-line p-3 text-sm break-words">
          <h3 className="font-semibold">{i + 1}. <MathText text={q.prompt} /></h3>
          <p className="mt-1 text-ink-muted">Your answer: <MathText text={q.options[detail.attempt?.answers[String(i)] ?? -1] ?? "Not answered"} /></p>
          <p className="text-ink-muted">Correct: <MathText text={q.options[q.correct ?? -1] ?? ""} /></p>
          {q.explanation ? <p className="mt-1"><MathText text={q.explanation} /></p> : null}
        </article>
      ))}
    </div>
  );
}

export function CourseRoster({ offering, challenge = null, teacher = true }: { offering: string; challenge?: string | null; teacher?: boolean }) {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<ChallengeRosterRow | null>(null);
  const query = useQuery({
    staleTime: 0,
    queryKey: ["challenge-roster", offering, challenge, search, offset],
    queryFn: () => api().roster(offering, challenge, search, offset),
    refetchInterval: 15000,
  });
  const detail = useQuery({
    staleTime: 0,
    queryKey: ["challenge-review", challenge, selected?.user_id],
    queryFn: () => api().detail(challenge!, selected!.user_id),
    enabled: Boolean(challenge && selected?.user_id),
  });

  const heading = query.data?.finished ? "Final ranking" : challenge ? "Participation" : "Students";
  const total = query.data?.total;
  const classRoster = !challenge;

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className={classRoster ? "text-xl font-bold tracking-tight sm:text-[1.35rem]" : "text-sm font-semibold text-ink sm:text-base"}>
            {heading}
          </h2>
          {typeof total === "number" ? (
            <p className="mt-0.5 text-xs text-ink-muted" aria-live="polite">
              {total} {total === 1 ? "student" : "students"}
              {classRoster ? " enrolled in this class" : ""}
            </p>
          ) : classRoster ? (
            <p className="mt-0.5 text-xs text-ink-muted">Enrolled students for this course.</p>
          ) : null}
        </div>
        <label className="block min-w-0 sm:w-56">
          <span className="sr-only">Search students</span>
          <Input
            value={search}
            maxLength={100}
            placeholder="Search name…"
            aria-label="Search students"
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
        </label>
      </div>

      <Failure error={query.error} retry={() => void query.refetch()} />
      {query.isPending ? <p role="status" className="text-sm text-ink-muted">Loading students…</p> : null}

      {query.data ? (
        <>
          {!query.data.items.length ? (
            <p className="rounded-card border border-line px-3.5 py-4 text-sm text-ink-muted">
              {search.trim() ? "No students match this search." : "No students enrolled yet."}
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-card" aria-label="Student list">
              {query.data.items.map((r, i) => {
                const meta = [
                  statusLabel(r, challenge),
                  r.score !== null ? `${r.score} pts` : null,
                  r.score !== null && r.elapsed_seconds != null ? `${Math.round(r.elapsed_seconds)}s` : null,
                ].filter(Boolean).join(" · ");
                return (
                  <li key={r.user_id ?? `${offset}-${i}`} className="flex min-w-0 items-center gap-2.5 px-3.5 py-2.5 sm:px-4">
                    {r.rank ? (
                      <span className="w-7 shrink-0 text-center text-xs font-bold tabular-nums text-ink-muted" aria-hidden>
                        {r.rank}
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1 break-words">
                      <p className="text-sm font-semibold leading-snug">
                        {r.name}{r.is_me ? <span className="font-normal text-ink-muted"> (You)</span> : null}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">{meta}</p>
                    </div>
                    {teacher && query.data.finished && r.user_id && r.status !== "not_participated" ? (
                      <Button size="sm" variant="secondary" onClick={() => setSelected(r)}>Review</Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <Paging offset={offset} hasMore={offset + 20 < query.data.total} change={setOffset} />
        </>
      ) : null}

      {selected ? (
        <section aria-label="Student answers" className="space-y-2 rounded-card border border-line p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{selected.name}</h3>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Close</Button>
          </div>
          <Failure error={detail.error} retry={() => void detail.refetch()} />
          {detail.data ? <QuestionReview detail={detail.data} /> : null}
        </section>
      ) : null}
    </section>
  );
}

/** Anchor to server time, then advance using a monotonic clock, not the device wall clock. */
export function useChallengeClock(serverTime?: string) {
  const [clock, setClock] = useState(() => Date.parse(serverTime ?? "") || 0);
  useEffect(() => {
    const anchor = performance.now();
    const server = Date.parse(serverTime ?? "") || Date.now();
    const update = () => setClock(server + performance.now() - anchor);
    const first = setTimeout(update, 0);
    const timer = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [serverTime]);
  return clock;
}
