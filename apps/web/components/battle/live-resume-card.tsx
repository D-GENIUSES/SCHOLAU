"use client";

import { Swords } from "lucide-react";
import Link from "next/link";
import type { LiveBattle } from "@scholau/api";
import type { BattleState } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const LIVE_STATE_COPY: Partial<Record<BattleState, { title: string; body: string; cta: string }>> = {
  waiting: { title: "Your challenge is open", body: "Share the invitation link with a classmate.", cta: "View challenge" },
  ready: { title: "Your battle is about to start", body: "Confirm you're ready before the window closes.", cta: "Go to battle" },
  countdown: { title: "Your battle is starting", body: "Rejoin now — the timer is already running.", cta: "Rejoin battle" },
  active: { title: "Your battle is in progress", body: "Rejoin now — the round timer continues.", cta: "Rejoin battle" },
};

/** Resume entry for the user's single live battle or queue slot. */
export function LiveResumeCard({ live }: { live: LiveBattle }) {
  const battle = live.battle;
  const queue = live.queue && live.queue.state === "waiting" ? live.queue : null;
  const copy = battle ? LIVE_STATE_COPY[battle.state] : null;
  if (battle && copy) {
    return (
      <ResumeCard
        title={copy.title}
        body={battle.course ? `${battle.course.code} · ${copy.body}` : copy.body}
        href={`/battles/${battle.battle_id}`}
        cta={copy.cta}
      />
    );
  }
  if (queue) {
    return <ResumeCard title="You're in the queue" body="We're still looking for an opponent." href="/battles/queue" cta="Return to the queue" />;
  }
  return null;
}

function ResumeCard({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <Card tint>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Swords className="size-5 text-brand-primary" aria-hidden />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      <CardFooter className="pt-2 sm:pt-2">
        <Button asChild>
          <Link href={href}>{cta}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
