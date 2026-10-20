"use client";

import { BookOpen } from "lucide-react";
import type { Battle, BattleParticipant } from "@scholau/api";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function BattleScoreboard({ battle }: { battle: Battle }) {
  const me = battle.participants.find((p) => p.is_me);
  const opponent = battle.participants.find((p) => !p.is_me);
  return <section aria-label="Battle players" className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-line bg-surface-card p-3 sm:p-5">
    <Player participant={me} />
    <span className="flex size-9 items-center justify-center rounded-full bg-surface-page text-xs font-bold text-ink-muted">VS</span>
    <Player participant={opponent} reverse />
  </section>;
}

function Player({ participant, reverse }: { participant?: BattleParticipant; reverse?: boolean }) {
  const name = participant?.display_name ?? "Opponent";
  return <div className={cn("flex min-w-0 items-center gap-2 sm:gap-3", reverse && "flex-row-reverse text-right")}>
    <Avatar name={name} path={participant?.avatar_path} size={40} />
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold sm:text-base" title={name}>{name}</p>
      <p className="text-xs text-ink-muted">{participant?.correct_count != null ? <><strong className="text-xl font-bold tabular-nums text-brand-primary sm:text-2xl">{participant.correct_count}</strong> correct</> : participant?.is_me ? "You" : "Challenger"}</p>
    </div>
  </div>;
}

export function BattleRoundProgress({ count, position, answered }: { count: number; position: number; answered: number[] }) {
  return <div className="flex flex-col gap-2">
    <div className="flex gap-1.5" aria-hidden>{Array.from({ length: count }, (_, i) => {
      const n = i + 1;
      return <span key={n} className={cn("flex h-2 min-w-0 flex-1 items-center justify-center rounded-full", n === position ? "bg-brand-primary ring-2 ring-brand-primary/15 ring-offset-2" : answered.includes(n) ? "bg-brand-primary/60" : "bg-line")} />;
    })}</div>
    <p className="text-center text-xs font-medium text-ink-muted">Question {position} of {count}<span className="sr-only"> · {answered.length} answers submitted</span></p>
  </div>;
}

export function BattleCourseStrip({ code, title }: { code?: string; title?: string }) {
  if (!code) return null;
  return <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-surface-tint px-3 py-2 text-sm">
    <BookOpen className="size-4 shrink-0 text-brand-primary" aria-hidden />
    <span className="shrink-0 font-bold">{code}</span>
    {title ? <span className="truncate border-l border-line pl-2.5 text-ink-muted" title={title}>{title}</span> : null}
  </div>;
}

export function BattleTimer({ remainingMs, totalMs, reading }: { remainingMs: number; totalMs: number; reading: boolean }) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const fraction = Math.max(0, Math.min(1, totalMs > 0 ? remainingMs / totalMs : 0));
  return <div className={cn("relative mx-auto flex size-[76px] shrink-0 items-center justify-center", !reading && seconds <= 2 ? "text-warning" : "text-brand-primary")} role="timer" aria-label={`${seconds} seconds ${reading ? "until answering opens" : "left to answer"}`}>
    <svg viewBox="0 0 80 80" className="absolute inset-0 size-full -rotate-90" aria-hidden>
      <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="6" />
      <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - fraction} />
    </svg>
    <span className="flex flex-col items-center leading-none"><strong className="text-2xl font-bold tabular-nums">{String(seconds).padStart(2, "0")}</strong><span className="mt-1 text-[10px] font-medium text-ink-muted">{reading ? "read first" : "sec left"}</span></span>
  </div>;
}
