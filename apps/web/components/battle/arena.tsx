"use client";

import type { Battle, BattleParticipant } from "@scholau/api";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function BattleScoreboard({ battle }: { battle: Battle }) {
  const me = battle.participants.find((p) => p.is_me);
  const opponent = battle.participants.find((p) => !p.is_me);
  return <section aria-label="Battle players" className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl border border-line bg-surface-card px-3 py-2 sm:p-3">
    <Player participant={me} />
    <span className="flex size-9 items-center justify-center rounded-full bg-surface-page text-xs font-bold text-ink-muted">VS</span>
    <Player participant={opponent} reverse />
  </section>;
}

function Player({ participant, reverse }: { participant?: BattleParticipant; reverse?: boolean }) {
  const name = participant?.display_name ?? "Opponent";
  return <div className={cn("flex min-w-0 items-center gap-2 sm:gap-3", reverse && "flex-row-reverse text-right")}>
    <Avatar name={name} path={participant?.avatar_path} size={32} />
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold sm:text-base" title={name}>{name}</p>
      <p className="text-xs text-ink-muted">{participant?.correct_count != null ? <><strong className="text-xl font-bold tabular-nums text-brand-primary sm:text-2xl">{participant.correct_count}</strong> correct</> : participant?.is_me ? "You" : "Challenger"}</p>
    </div>
  </div>;
}

export function BattleRoundProgress({ count, position, answered }: { count: number; position: number; answered: number[] }) {
  const completed = Math.min(count, new Set(answered).size);
  return <div className="flex min-w-0 items-center gap-3" aria-label={`Question ${position} of ${count}`}>
    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Answers submitted" aria-valuemin={0} aria-valuemax={count} aria-valuenow={completed}>
      <div className="h-full rounded-full bg-brand-primary" style={{ width: `${count > 0 ? completed / count * 100 : 0}%` }} />
    </div>
    <p className="shrink-0 text-xs font-semibold tabular-nums text-ink-muted">{position}/{count}</p>
  </div>;
}

export function BattleCourseStrip({ code, title }: { code?: string; title?: string }) {
  if (!code) return null;
  return <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-surface-tint px-3 py-2 text-sm">
    <span className="shrink-0 font-bold">{code}</span>
    {title ? <span className="truncate border-l border-line pl-2.5 text-ink-muted" title={title}>{title}</span> : null}
  </div>;
}

export function BattleTimer({ remainingMs, totalMs, reading }: { remainingMs: number; totalMs: number; reading: boolean }) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const fraction = Math.max(0, Math.min(1, totalMs > 0 ? remainingMs / totalMs : 0));
  return <div className={cn("relative flex size-[56px] shrink-0 items-center justify-center sm:size-[64px]", !reading && seconds <= 2 ? "text-warning" : "text-brand-primary")} role="timer" aria-label={`${seconds} seconds ${reading ? "until answering opens" : "left to answer"}`}>
    <svg viewBox="0 0 80 80" className="absolute inset-0 size-full -rotate-90" aria-hidden>
      <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="6" />
      <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - fraction} />
    </svg>
    <span className="flex flex-col items-center leading-none"><strong className="text-xl font-bold tabular-nums">{String(seconds).padStart(2, "0")}</strong><span className="mt-1 text-[10px] font-medium text-ink-muted">{reading ? "read" : "answer"}</span></span>
  </div>;
}
