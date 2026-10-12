"use client";

import { Link2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HomeSummary } from "@scholau/api";
import { useCreateDirectBattle, useJoinQueue } from "@scholau/api/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/input";
import { useAnalytics } from "@/lib/analytics";
import { BattleActionError } from "./action-error";

type EnrolledCourse = HomeSummary["enrolled_courses"][number];

/** Course picker plus the two ways to start a battle (queue or direct invitation). */
export function BattleStartPanel({ courses, initialOfferingId }: { courses: EnrolledCourse[]; initialOfferingId: string | null }) {
  const router = useRouter();
  const analytics = useAnalytics();
  const joinQueue = useJoinQueue();
  const createDirect = useCreateDirectBattle();
  const fallback = courses.find((c) => c.offering_id === initialOfferingId)?.offering_id ?? courses[0]?.offering_id ?? "";
  const [picked, setPicked] = useState<string | null>(null);
  const offeringId = picked ?? fallback;
  const busy = joinQueue.isPending || createDirect.isPending;
  const error = joinQueue.error ?? createDirect.error;

  const findOpponent = () => {
    createDirect.reset();
    joinQueue.mutate(
      { offeringId },
      {
        onSuccess: (ack) => {
          if (ack.battle_id) router.push(`/battles/${ack.battle_id}`);
          else router.push(`/battles/queue?offering=${encodeURIComponent(ack.offering_id)}`);
        },
      },
    );
  };

  const challengeFriend = () => {
    joinQueue.reset();
    createDirect.mutate(
      { offeringId },
      {
        onSuccess: (battle) => {
          analytics.track({ name: "battle_queued", mode: "direct" });
          router.push(`/battles/${battle.battle_id}`);
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a battle</CardTitle>
        <CardDescription>Pick a course, then find a random opponent or challenge a classmate with a link.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field id="battle-course" label="Course">
          <NativeSelect
            value={offeringId}
            onChange={(e) => {
              setPicked(e.target.value);
              joinQueue.reset();
              createDirect.reset();
            }}
            disabled={busy}
          >
            {courses.map((c) => (
              <option key={c.offering_id} value={c.offering_id}>
                {c.code} — {c.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={findOpponent} loading={joinQueue.isPending} disabled={busy || !offeringId} className="sm:flex-1">
            {joinQueue.isPending ? null : <Search className="size-5" aria-hidden />}
            Find an opponent
          </Button>
          <Button
            variant="outline"
            onClick={challengeFriend}
            loading={createDirect.isPending}
            disabled={busy || !offeringId}
            className="sm:flex-1"
          >
            {createDirect.isPending ? null : <Link2 className="size-5" aria-hidden />}
            Challenge a friend
          </Button>
        </div>
        <BattleActionError error={error} />
      </CardContent>
    </Card>
  );
}
