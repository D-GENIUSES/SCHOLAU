"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { useHomeSummary, useJoinQueue, useLeaveQueue, useMyLiveBattle } from "@scholau/api/react";
import { BattleActionError } from "@/components/battle/action-error";
import { NoOpponent, QueueWaiting } from "@/components/battle/queue-view";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { ErrorState, InlineError, LoadingState, Spinner } from "@/components/ui/states";
import { useAnalytics } from "@/lib/analytics";

export default function QueuePage() {
  return (
    <Suspense fallback={<LoadingState variant="battle" label="Loading queue…" />}>
      <Queue />
    </Suspense>
  );
}

function Queue() {
  const router = useRouter();
  const params = useSearchParams();
  const analytics = useAnalytics();
  const live = useMyLiveBattle({ refetchInterval: 2000 });
  const home = useHomeSummary();
  const join = useJoinQueue();
  const leave = useLeaveQueue();
  const tracked = useRef<Set<string>>(new Set());

  const queue = live.data?.queue && live.data.queue.state === "waiting" ? live.data.queue : null;
  const battleId = live.data?.battle?.battle_id ?? null;

  const [lastOffering, setLastOffering] = useState<string | null>(null);
  if (queue && queue.offering_id !== lastOffering) setLastOffering(queue.offering_id);

  useEffect(() => {
    if (battleId) router.replace(`/battles/${battleId}`);
  }, [battleId, router]);

  const queueId = queue?.queue_id ?? null;
  useEffect(() => {
    if (!queueId || tracked.current.has(queueId)) return;
    tracked.current.add(queueId);
    analytics.track({ name: "battle_queued", mode: "queue" });
  }, [queueId, analytics]);

  const retryOffering = params.get("offering") ?? lastOffering;
  const offeringId = queue?.offering_id ?? retryOffering;
  const course = home.data?.enrolled_courses.find((c) => c.offering_id === offeringId);
  const courseLabel = course ? `${course.code} — ${course.title}` : null;

  const tryAgain = () => {
    const target = retryOffering;
    if (!target) return;
    join.mutate(
      { offeringId: target },
      {
        onSuccess: (ack) => {
          if (ack.battle_id) router.replace(`/battles/${ack.battle_id}`);
          else void live.refetch();
        },
      },
    );
  };

  const cancel = () => {
    leave.mutate(undefined, {
      onSuccess: (res) => {
        if (res.state === "matched" && res.battle_id) router.replace(`/battles/${res.battle_id}`);
        else router.push("/battles");
      },
    });
  };

  const noOpponent = (
    <div className="flex flex-col gap-3">
      <NoOpponent onRetry={tryAgain} retrying={join.isPending} canRetry={Boolean(retryOffering)} />
      <BattleActionError error={join.error} />
    </div>
  );

  let body: ReactNode;
  if (live.isPending || (!live.isFetchedAfterMount && !queue && !battleId)) {
    body = <LoadingState variant="battle" label="Checking the queue…" lines={2} />;
  } else if (live.isError && !live.data) {
    body = <ErrorState error={live.error} onRetry={() => void live.refetch()} />;
  } else if (battleId) {
    body = (
      <div className="flex justify-center py-10">
        <Spinner label="Opponent found! Opening your battle…" />
      </div>
    );
  } else if (queue) {
    body = (
      <div className="flex flex-col gap-3">
        <QueueWaiting
          key={queue.queue_id}
          queue={queue}
          courseLabel={courseLabel}
          onCancel={cancel}
          cancelling={leave.isPending}
          noOpponent={noOpponent}
        />
        <InlineError error={leave.error} />
      </div>
    );
  } else {
    body = noOpponent;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Battle queue"
        title="Find an opponent"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/battles">Back to battles</Link>
          </Button>
        }
      />
      {body}
    </div>
  );
}
