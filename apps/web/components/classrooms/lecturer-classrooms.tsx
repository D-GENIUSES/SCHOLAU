"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, BookOpen, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { qk } from "@scholau/api";
import type { LecturerOffering } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { Failure } from "@/components/challenges/course-challenges";
import { classroomApi } from "@/lib/classroom-api";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const api = () => classroomApi(getBrowserSupabase());

export function LecturerClassrooms({ courses }: { courses: LecturerOffering[] }) {
  const router = useRouter();
  const queries = useQueryClient();
  const [offeringId, setOfferingId] = useState(courses[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const options = useQuery({
    queryKey: ["classroom-programmes", offeringId],
    queryFn: () => api().options(offeringId),
    enabled: Boolean(offeringId),
    staleTime: 60_000,
  });
  const rooms = useQuery({ queryKey: qk.classrooms(archived), queryFn: () => api().list(archived), refetchOnWindowFocus: true });
  const create = useMutation({
    mutationFn: () => api().create(offeringId, title, selected),
    onSuccess: async result => {
      setTitle(""); setSelected([]); setError(null);
      await queries.invalidateQueries({ queryKey: qk.classrooms(false) });
      router.push(`/lecturer/classrooms/${result.classroom.id}`);
    },
    onError: setError,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight">Classrooms</h1><p className="mt-1 text-sm text-ink-muted">Create a room, share its link, and manage course activities in one place.</p></div>
        <Button type="button" variant="outline" onClick={() => setArchived(value => !value)}><Archive className="size-4" aria-hidden />{archived ? "Active rooms" : "Archived rooms"}</Button>
      </header>

      {!archived ? <section aria-labelledby="create-classroom" className="space-y-3 rounded-card border border-line bg-surface-card p-4">
        <h2 id="create-classroom" className="text-base font-bold">Create a classroom</h2>
        {!courses.length ? <p className="text-sm text-ink-muted">A teaching course assignment is required to create a room.</p> : <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Course
              <NativeSelect className="mt-1" value={offeringId} onChange={event => { setOfferingId(event.target.value); setSelected([]); }}>
                {courses.map(course => <option key={course.id} value={course.id}>{course.code} · {course.title} · {course.department}</option>)}
              </NativeSelect>
            </label>
            <label className="block text-sm font-medium">Room name
              <Input className="mt-1" required maxLength={120} placeholder="e.g. COS 201 Revision Group" value={title} onChange={event => setTitle(event.target.value)} />
            </label>
          </div>
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-semibold">Who can join?</legend>
            <p className="mb-2 text-xs text-ink-muted">Only currently enrolled students in the selected programmes can use the invite link.</p>
            {options.isPending ? <p role="status" className="text-sm text-ink-muted">Loading course programmes…</p> : null}
            <Failure error={options.error} retry={() => void options.refetch()} />
            {options.data?.items.map(programme => <label key={programme.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.includes(programme.id)} onChange={event => setSelected(current => event.target.checked ? [...current, programme.id] : current.filter(id => id !== programme.id))} />
              {programme.department_name}
            </label>)}
            {options.data && !options.data.items.length ? <p className="text-sm text-ink-muted">No programmes are currently available for this course.</p> : null}
          </fieldset>
          {error ? <Failure error={error} /> : null}
          <Button disabled={create.isPending || !title.trim() || selected.length === 0 || !options.data?.items.length} loading={create.isPending} onClick={() => { setError(null); create.mutate(); }}>
            <Plus className="size-4" aria-hidden /> Create classroom
          </Button>
        </>}
      </section> : null}

      <section className="space-y-3">
        <h2 className="text-base font-bold">{archived ? "Archived classrooms" : "Your classrooms"}</h2>
        <Failure error={rooms.error} retry={() => void rooms.refetch()} />
        {rooms.isPending ? <p role="status" className="text-sm text-ink-muted">Loading classrooms…</p> : null}
        {rooms.data?.items.length === 0 ? <EmptyState title={archived ? "No archived classrooms" : "No classrooms yet"} description={archived ? "Archived rooms and their results will appear here." : "Create a classroom to share course quizzes and challenges with a selected programme group."} /> : null}
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-card">
          {rooms.data?.items.map(({ classroom }) => <li key={classroom.id}>
            <Link href={`/lecturer/classrooms/${classroom.id}`} className="flex min-h-16 min-w-0 items-center gap-3 px-3.5 py-3 hover:bg-surface-tint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary sm:px-4">
              <BookOpen className="size-5 shrink-0 text-brand-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{classroom.title}</p>
                <p className="truncate text-xs text-ink-muted">{classroom.course.code} · {classroom.course.title} · {classroom.programmes.join(", ")}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted"><Users className="size-3.5" aria-hidden />{classroom.member_count}</span>
              <span className="hidden rounded-full border border-line px-2 py-1 text-[11px] capitalize text-ink-muted sm:inline">{classroom.archived_at ? "Archived" : classroom.join_open ? "Open" : "Join closed"}</span>
            </Link>
          </li>)}
        </ul>
      </section>
    </div>
  );
}
