"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HomeSummary } from "@scholau/api";
import { useBattleSetup, useCreateDirectBattle, useFriends, useJoinQueue } from "@scholau/api/react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/input";
import { InlineError, LoadingState } from "@/components/ui/states";
import { BattleActionError } from "./action-error";

type EnrolledCourse = HomeSummary["enrolled_courses"][number];
export function BattleStartPanel({ initialOfferingId }: { courses: EnrolledCourse[]; initialOfferingId: string | null }) {
  const router = useRouter();
  const [friendId, setFriendId] = useState("");
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const friends = useFriends();
  const setup = useBattleSetup(friendId || null);
  const direct = useCreateDirectBattle();
  const queue = useJoinQueue();
  const courses = setup.data?.courses ?? [];
  const fallback = courses.find((c) => c.offering_id === initialOfferingId) ?? courses[0];
  const selected = chosen === null ? fallback ? [fallback.offering_id] : [] : chosen.filter((id) => courses.some((c) => c.offering_id === id));
  const scope = selected.map((id) => courses.find((c) => c.offering_id === id)!);
  const available = scope.length > 0 && scope.every((c, index) => c.available_questions >= Math.floor(questionCount / scope.length) + (index < questionCount % scope.length ? 1 : 0));
  const busy = direct.isPending || queue.isPending;
  const toggle = (id: string) => {
    setChosen(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    direct.reset(); queue.reset();
  };

  return (
    <Card>
      <CardHeader><CardTitle>Start a battle</CardTitle><CardDescription>Choose up to three courses and a quick question set.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label className="text-sm font-semibold">Invite a friend
          <NativeSelect value={friendId} disabled={busy} onChange={(e) => { setFriendId(e.target.value); setChosen(null); direct.reset(); queue.reset(); }}>
            <option value="">Create an invitation link</option>
            {friends.data?.people.filter((p) => p.state === "accepted").map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name} · @{p.username}</option>)}
          </NativeSelect>
        </label>
        <InlineError error={friends.error} />
        {setup.isPending ? <LoadingState label="Loading shared courses…" /> : null}
        <InlineError error={setup.error} />
        {setup.isSuccess && courses.length === 0 ? <Alert title="No shared courses yet">Choose a friend enrolled in the same course, or create an invitation link.</Alert> : null}
        <fieldset disabled={busy} className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">{friendId ? "Shared courses" : "Your courses"} · choose 1–3</legend>
          {courses.map((course) => <label key={course.offering_id} className="flex items-center gap-3 rounded-xl border border-line p-3">
            <input type="checkbox" checked={selected.includes(course.offering_id)} disabled={!selected.includes(course.offering_id) && selected.length >= 3}
              onChange={() => toggle(course.offering_id)} className="size-5 accent-brand-primary" />
            <span className="min-w-0 flex-1 text-sm"><strong>{course.code}</strong> — {course.title}<span className="block text-xs text-ink-muted">{course.available_questions} battle questions published</span></span>
          </label>)}
        </fieldset>
        <label className="text-sm font-semibold">Total questions
          <NativeSelect value={questionCount} disabled={busy} onChange={(e) => { setQuestionCount(Number(e.target.value)); direct.reset(); }}>
            {[5, 10, 15, 20, 25, 30].map((count) => <option key={count} value={count}>{count} questions</option>)}
          </NativeSelect>
        </label>
        <p className="text-sm text-ink-muted">About {Math.ceil(questionCount * 7 / 60)}–{Math.ceil(questionCount * 27 / 60)} minutes, including reading time. Questions are balanced across the selected courses; both players get the same set.</p>
        {setup.isSuccess && scope.length > 0 && !available ? <Alert tone="info" title="Questions are on their way">This selection needs more published battle questions. It becomes available as soon as enough questions are published.</Alert> : null}
        <Button disabled={busy || !available} loading={direct.isPending} onClick={() => direct.mutate({ offeringId: selected[0]!, offeringIds: selected, questionCount, friendId: friendId || null }, { onSuccess: (battle) => router.push(`/battles/${battle.battle_id}`) })}>{friendId ? "Send battle invitation" : "Create invitation link"}</Button>
        {!friendId ? <Button variant="outline" disabled={busy || scope.length !== 1 || scope[0]!.available_questions < 5} loading={queue.isPending}
          onClick={() => queue.mutate({ offeringId: selected[0]! }, { onSuccess: (ack) => router.push(ack.battle_id ? `/battles/${ack.battle_id}` : "/battles/queue") })}>Quick random match · 5 questions, one course</Button> : null}
        <BattleActionError error={direct.error ?? queue.error} />
      </CardContent>
    </Card>
  );
}
