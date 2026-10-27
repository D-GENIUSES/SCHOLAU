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
  return <div role="alert" className="rounded-lg border border-danger p-3"><p>{challengeError(error)}</p>{retry && <Button type="button" variant="secondary" onClick={retry}>Retry / refresh</Button>}</div>;
}
export function Paging({ offset, hasMore, change }: { offset: number; hasMore: boolean; change: (offset: number) => void }) {
  return <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={!offset} onClick={() => change(Math.max(0, offset - 20))}>Previous page</Button><Button type="button" variant="secondary" disabled={!hasMore} onClick={() => change(offset + 20)}>Next page</Button></div>;
}
export function CourseChallenges({ offering }: { offering: string }) {
  const [offset, setOffset] = useState(0);
  const query = useQuery({ staleTime: 0, queryKey: ["course-challenges", offering, offset], queryFn: () => api().list(offering, offset), refetchInterval: 15000 });
  return <section className="space-y-4 min-w-0"><h1 className="text-2xl font-bold">Course challenges</h1>
    <Failure error={query.error} retry={() => void query.refetch()} />
    {query.isPending && <p role="status">Loading challenges…</p>}
    {query.data && <><p>{query.data.course.code} · {query.data.course.title}<br />{query.data.course.period} · {query.data.course.semester}</p>
      <Link className="inline-flex min-h-11 items-center underline" href={query.data.teacher ? "/lecturer" : `/study/courses/${offering}`}>Back to course</Link>
      {query.data.teacher && <div className="flex flex-wrap gap-3"><Button asChild><Link href={`/lecturer/courses/${offering}/challenges/new`}>Create challenge</Link></Button><Button asChild variant="secondary"><Link href={`/lecturer/courses/${offering}/students`}>Enrolled students</Link></Button></div>}
      {!query.data.items.length && <p>No challenges on this page.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">{query.data.items.map(c => <li key={c.id} className="min-w-0 rounded-xl border border-line p-4 space-y-2 break-words"><h2 className="font-bold">{c.title}</h2><p className="capitalize">{c.state} · {c.question_count} questions · {c.duration_minutes} minutes</p><p>{c.starts_at ? new Date(c.starts_at).toLocaleString() : "Unpublished draft"}</p><Button asChild variant="secondary"><Link href={`/challenges/${c.id}`}>Open challenge</Link></Button></li>)}</ul>
      <Paging offset={offset} hasMore={query.data.items.length === 20} change={setOffset} /></>}
  </section>;
}
export function QuestionReview({ detail }: { detail: ChallengeDetail }) {
  return <div className="space-y-3"><p className="font-bold">Score: {detail.attempt?.score ?? 0}/{detail.challenge.question_count}</p>{detail.questions.map((q, i) => <article key={i} className="border border-line rounded-lg p-3 break-words"><h3 className="font-semibold">{i + 1}. <MathText text={q.prompt} /></h3><p>Your answer: <MathText text={q.options[detail.attempt?.answers[String(i)] ?? -1] ?? "Not answered"} /></p><p>Correct answer: <MathText text={q.options[q.correct ?? -1] ?? ""} /></p>{q.explanation && <p><MathText text={q.explanation} /></p>}</article>)}</div>;
}
export function CourseRoster({ offering, challenge = null, teacher = true }: { offering: string; challenge?: string | null; teacher?: boolean }) {
  const [search, setSearch] = useState(""), [offset, setOffset] = useState(0), [selected, setSelected] = useState<ChallengeRosterRow | null>(null);
  const query = useQuery({ staleTime: 0, queryKey: ["challenge-roster", offering, challenge, search, offset], queryFn: () => api().roster(offering, challenge, search, offset), refetchInterval: 15000 });
  const detail = useQuery({ staleTime: 0, queryKey: ["challenge-review", challenge, selected?.user_id], queryFn: () => api().detail(challenge!, selected!.user_id), enabled: Boolean(challenge && selected?.user_id) });
  return <section className="space-y-4 min-w-0"><h2 className="text-xl font-bold">{query.data?.finished ? "Final ranking" : challenge ? "Participation" : "Enrolled students"}</h2>
    <label className="block">Search students<Input value={search} maxLength={100} onChange={e => { setSearch(e.target.value); setOffset(0); }} /></label>
    <Failure error={query.error} retry={() => void query.refetch()} />{query.isPending && <p role="status">Loading students…</p>}
    {query.data && <><p>{query.data.total} students</p><ul className="space-y-2">{query.data.items.map((r, i) => <li key={r.user_id ?? `${offset}-${i}`} className="rounded-lg border border-line p-3 flex flex-wrap items-center justify-between gap-2 break-words"><div className="min-w-0"><strong>{r.rank ? `#${r.rank} · ` : ""}{r.name}{r.is_me ? " (You)" : ""}</strong><p>{challenge ? r.status === "not_participated" ? "Did not participate" : r.status === "submitted" ? "Submitted" : "Participating" : "Enrolled"}{r.score !== null ? ` · ${r.score} points · ${Math.round(r.elapsed_seconds ?? 0)} seconds` : ""}</p></div>{teacher && query.data.finished && r.user_id && r.status !== "not_participated" && <Button variant="secondary" onClick={() => setSelected(r)}>Review answers</Button>}</li>)}</ul><Paging offset={offset} hasMore={offset + 20 < query.data.total} change={setOffset} /></>}
    {selected && <section aria-label="Student answers" className="border border-line rounded-xl p-4 space-y-3"><h3 className="font-bold">{selected.name}</h3><Button variant="secondary" onClick={() => setSelected(null)}>Close review</Button><Failure error={detail.error} retry={() => void detail.refetch()} />{detail.data && <QuestionReview detail={detail.data} />}</section>}
  </section>;
}
// Anchor to server time, then advance using a monotonic clock, not the device wall clock.
export function useChallengeClock(serverTime?: string) {
  const [clock, setClock] = useState(() => Date.parse(serverTime ?? "") || 0);
  useEffect(() => {
    const anchor = performance.now(), server = Date.parse(serverTime ?? "") || Date.now();
    const update = () => setClock(server + performance.now() - anchor);
    const first = setTimeout(update, 0), timer = setInterval(update, 1000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [serverTime]);
  return clock;
}
