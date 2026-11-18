"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Copy, DoorOpen, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore, useState } from "react";
import { qk } from "@scholau/api";
import { Button } from "@/components/ui/button";
import { Failure } from "@/components/challenges/course-challenges";
import { classroomApi } from "@/lib/classroom-api";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const api = () => classroomApi(getBrowserSupabase());
const subscribeOrigin = () => () => {};
const readOrigin = () => window.location.origin;

export function ClassroomView({ id }: { id: string }) {
  const queries = useQueryClient();
  const [message, setMessage] = useState("");
  const query = useQuery({ queryKey: qk.classroom(id), queryFn: () => api().detail(id), refetchInterval: 20_000 });
  const setOpen = useMutation({
    mutationFn: (open: boolean) => api().setJoinOpen(id, open),
    onSuccess: () => queries.invalidateQueries({ queryKey: qk.classroom(id) }),
  });
  const archive = useMutation({
    mutationFn: () => api().archive(id),
    onSuccess: async () => { await queries.invalidateQueries({ queryKey: qk.classrooms(false) }); await query.refetch(); },
  });
  const origin = useSyncExternalStore(subscribeOrigin, readOrigin, () => "");
  if (!query.data) return <div className="mx-auto max-w-4xl space-y-3"><Failure error={query.error} retry={() => void query.refetch()} />{query.isPending ? <p role="status">Loading classroom…</p> : null}</div>;

  const detail = query.data;
  const classroom = detail.classroom;
  const isTeacher = detail.teacher;
  const archived = Boolean(classroom.archived_at);
  const inviteUrl = `${origin}/classrooms/join/${id}`;
  async function copyLink() {
    try { await navigator.clipboard.writeText(inviteUrl); setMessage("Invite link copied."); }
    catch { setMessage("Copy the invite link from the field above."); }
  }
  const quizHref = (quizId: string) => isTeacher
    ? `/lecturer/courses/${classroom.offering_id}/quizzes/${quizId}`
    : `/course-quizzes/${quizId}`;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link className="inline-flex min-h-9 items-center text-sm font-semibold text-brand-primary underline-offset-2 hover:underline" href={isTeacher ? "/lecturer/classrooms" : "/classrooms"}>Back to classrooms</Link>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{classroom.title}</h1>
          <span className="rounded-full border border-line px-2 py-1 text-[11px] text-ink-muted">{archived ? "Archived" : classroom.join_open ? "Open to join" : "Join closed"}</span>
        </div>
        <p className="text-sm text-ink-muted">{classroom.course.code} · {classroom.course.title} · {classroom.course.period} · {classroom.course.semester}</p>
        <p className="text-sm text-ink-muted">Programmes: {classroom.programmes.join(", ")}</p>
      </header>

      {isTeacher ? <section aria-labelledby="room-access" className="space-y-3 rounded-card border border-line bg-surface-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 id="room-access" className="text-base font-bold">Room access</h2><p className="text-sm text-ink-muted"><Users className="mr-1 inline size-4" aria-hidden />{classroom.member_count} {classroom.member_count === 1 ? "member" : "members"}</p></div>
          <div className="flex flex-wrap gap-2">
            {!archived ? <Button variant="outline" size="sm" disabled={setOpen.isPending} onClick={() => setOpen.mutate(!classroom.join_open)}>
              <DoorOpen className="size-4" aria-hidden />{classroom.join_open ? "Close joining" : "Reopen joining"}
            </Button> : null}
            {!archived ? <Button variant="outline" size="sm" disabled={archive.isPending} onClick={() => {
              if (window.confirm("Archive this classroom? Students will lose access to its activities, while results remain available to you.")) archive.mutate();
            }}><Archive className="size-4" aria-hidden />Archive</Button> : null}
          </div>
        </div>
        {!archived ? <div className="flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1"><span className="sr-only">Classroom invite link</span><input readOnly value={inviteUrl} className="min-h-11 w-full rounded-control border border-line bg-surface-page px-3 text-sm" /></label>
          <Button variant="secondary" onClick={() => void copyLink()}><Copy className="size-4" aria-hidden />Copy invite link</Button>
        </div> : <p className="text-sm text-ink-muted">This room is archived. Its activities and results are preserved for your review.</p>}
        {message ? <p role="status" className="text-sm text-ink-muted">{message}</p> : null}
        <Failure error={setOpen.error || archive.error} retry={() => { setOpen.reset(); archive.reset(); }} />
      </section> : <p className="rounded-card border border-line bg-surface-card p-3 text-sm">You are a member of this classroom.</p>}

      {isTeacher && !archived ? <section aria-label="Create classroom activity" className="flex flex-wrap gap-2">
        <Button asChild><Link href={`/lecturer/classrooms/${id}/quizzes/new`}><Plus className="size-4" aria-hidden />Create quiz</Link></Button>
        <Button asChild variant="outline"><Link href={`/lecturer/classrooms/${id}/challenges/new`}><Plus className="size-4" aria-hidden />Create course challenge</Link></Button>
      </section> : null}

      <section className="space-y-2">
        <h2 className="text-base font-bold">Quizzes</h2>
        {detail.quizzes.length ? <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-card">
          {detail.quizzes.map(quiz => <li key={quiz.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-3.5 py-3 sm:px-4">
            <div className="min-w-0"><p className="font-semibold">{quiz.title}</p><p className="text-xs capitalize text-ink-muted">{quiz.state} · {quiz.question_count} questions · {quiz.duration_minutes} min</p></div>
            <Button asChild variant="secondary" size="sm"><Link href={quizHref(quiz.id)}>{isTeacher && quiz.state === "draft" ? "Edit draft" : isTeacher ? "Manage" : quiz.state === "open" ? "Take quiz" : "View quiz"}</Link></Button>
          </li>)}
        </ul> : <p className="rounded-card border border-line p-3 text-sm text-ink-muted">No quizzes in this room yet.</p>}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold">Course challenges</h2>
        {detail.challenges.length ? <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-card">
          {detail.challenges.map(challenge => <li key={challenge.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-3.5 py-3 sm:px-4">
            <div className="min-w-0"><p className="font-semibold">{challenge.title}</p><p className="text-xs capitalize text-ink-muted">{challenge.state} · {challenge.question_count} questions · {challenge.duration_minutes} min</p></div>
            <Button asChild variant="secondary" size="sm"><Link href={`/challenges/${challenge.id}`}>{isTeacher && challenge.state === "draft" ? "Edit draft" : isTeacher ? "Manage" : challenge.state === "active" ? "Join challenge" : "View challenge"}</Link></Button>
          </li>)}
        </ul> : <p className="rounded-card border border-line p-3 text-sm text-ink-muted">No course challenges in this room yet.</p>}
      </section>
      {isTeacher ? <p className="text-xs text-ink-muted">Published activities are available only to room members. Course-wide quiz and challenge lists do not include these activities.</p> : null}
    </div>
  );
}

export function StudentClassrooms() {
  const query = useQuery({ queryKey: qk.classrooms(false), queryFn: () => api().list(false), refetchOnWindowFocus: true });
  return <div className="mx-auto max-w-4xl space-y-4">
    <header><h1 className="text-2xl font-bold tracking-tight">My classrooms</h1><p className="mt-1 text-sm text-ink-muted">Rooms you have joined and their quizzes and course challenges.</p></header>
    <Failure error={query.error} retry={() => void query.refetch()} />
    {query.isPending ? <p role="status">Loading classrooms…</p> : null}
    {query.data?.items.length === 0 ? <p className="rounded-card border border-line bg-surface-card p-4 text-sm text-ink-muted">You haven’t joined a classroom yet. Open an invite link from your lecturer to join.</p> : null}
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-card">
      {query.data?.items.filter(item => item.member).map(({ classroom }) => <li key={classroom.id}>
        <Link href={`/classrooms/${classroom.id}`} className="flex min-h-16 min-w-0 items-center justify-between gap-3 px-3.5 py-3 hover:bg-surface-tint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary sm:px-4">
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{classroom.title}</span><span className="block truncate text-xs text-ink-muted">{classroom.course.code} · {classroom.course.title} · {classroom.programmes.join(", ")}</span></span>
          <span className="shrink-0 text-xs text-ink-muted">{classroom.member_count} members</span>
        </Link>
      </li>)}
    </ul>
  </div>;
}

export function ClassroomInvite({ id }: { id: string }) {
  const queries = useQueryClient();
  const router = useRouter();
  const query = useQuery({ queryKey: qk.classroomInvite(id), queryFn: () => api().invite(id) });
  const join = useMutation({
    mutationFn: () => api().join(id),
    onSuccess: async () => {
      await queries.invalidateQueries({ queryKey: qk.classrooms(false) });
      await queries.invalidateQueries({ queryKey: qk.classroom(id) });
      router.push(`/classrooms/${id}`);
    },
  });
  if (!query.data) return <div className="mx-auto max-w-xl space-y-3"><Failure error={query.error} retry={() => void query.refetch()} />{query.isPending ? <p role="status">Loading classroom invite…</p> : null}</div>;
  const invite = query.data;
  const room = invite.classroom;
  return <div className="mx-auto max-w-xl space-y-4 rounded-card border border-line bg-surface-card p-5">
    <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">Classroom invite</p>
    <h1 className="text-xl font-bold">{room.title}</h1>
    <p className="text-sm text-ink-muted">{room.course.code} · {room.course.title} · {room.course.period} · {room.course.semester}</p>
    <p className="text-sm">Eligible programmes: {room.programmes.join(", ")}</p>
    <Failure error={join.error} retry={() => join.reset()} />
    {invite.is_member && !room.archived_at ? <><p role="status" className="text-sm">You have already joined this classroom.</p><Button asChild><Link href={`/classrooms/${id}`}>Open classroom</Link></Button></>
      : room.archived_at ? <p role="status" className="text-sm text-ink-muted">This classroom has been archived. Contact your lecturer if you need help with a past activity.</p>
      : !invite.is_eligible ? <p role="status" className="text-sm text-ink-muted">Your account does not have an active enrollment in an eligible programme for this classroom.</p>
      : !room.join_open ? <p role="status" className="text-sm text-ink-muted">The lecturer has closed this classroom to new members.</p>
      : <Button loading={join.isPending} onClick={() => join.mutate()}><DoorOpen className="size-4" aria-hidden />Join classroom</Button>}
  </div>;
}
