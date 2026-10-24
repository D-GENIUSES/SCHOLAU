"use client";


import { ArrowLeft, Check, LogOut, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { ReactNode, Ref } from "react";
import type { Battle, BattleParticipant } from "@scholau/api";
import { COPY } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Logo } from "@/components/logo";
import { InlineError } from "@/components/ui/states";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<Battle["state"], string> = {
  waiting: "Waiting for opponent",
  ready: "Get ready",
  countdown: "Starting",
  active: "In progress",
  finished: "Finished",
  cancelled: "Cancelled",
  voided: "Voided",
};

const ACCENT = "#0875e4";

export function BattleTopBar({
  battle,
  live,
  onLeave,
}: {
  battle: Battle | undefined;
  live: boolean;
  onLeave: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xl font-bold tracking-tight sm:text-2xl">{battle?.state === "active" ? "Live battle" : "Battle"}</p>
        {battle ? <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">{battle.state === "active" ? <span className="size-1.5 rounded-full bg-success" aria-hidden /> : null}{STATE_LABEL[battle.state]}</p> : null}
      </div>
      {live ? (
        <div className="flex items-center gap-2.5">
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-ink">Live battle</h1>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#179a45]">
            <span className="size-2 rounded-full bg-[#22c55e]" aria-hidden />
            Live
          </span>
        </div>
      ) : battle ? (
        <p className="sr-only">{STATE_LABEL[battle.state]}</p>
      ) : null}
    </div>
  );
}

function playerHandle(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return "Player";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function PlayerSide({ participant, align }: { participant: BattleParticipant | undefined; align: "left" | "right" }) {
  const name = participant?.display_name ?? (align === "left" ? "You" : "Opponent");
  const score = participant?.correct_count ?? 0;
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-3", align === "right" && "flex-row-reverse text-right")}>
      {participant?.user_id ? <Link href={`/people/${participant.user_id}`} className="rounded-full focus-visible:outline-2 focus-visible:outline-brand-primary" aria-label={`View ${name}'s public profile`}><Avatar name={name} path={participant.avatar_path} size={56} /></Link> : <Avatar name={name} size={56} />}
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-[#8b9caf]">{participant?.user_id ? <Link href={`/people/${participant.user_id}`} className="hover:underline">{playerHandle(participant.display_name)}</Link> : playerHandle(name)}</p>
        <p className="mt-0.5 text-[30px] font-extrabold leading-none tracking-[-0.04em] text-[#0875e4] tabular-nums">{score}</p>
      </div>
    </div>
  );
}

/** Both seats. Scores are the server correct counts; live matches omit them until the result. */
export function BattlePlayers({ participants }: { participants: BattleParticipant[] }) {
  const me = participants.find((p) => p.is_me) ?? participants[0];
  const opponent = participants.find((p) => p !== me);
  return (
    <div className="flex items-center gap-2 rounded-[20px] border border-[#e7eef5] bg-white px-4 py-4 shadow-[0_8px_30px_rgba(17,36,60,0.04)] sm:px-5">
      <PlayerSide participant={me} align="left" />
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f2f4f7] text-xs font-semibold lowercase text-[#93a1b0]">vs</span>
      <PlayerSide participant={opponent} align="right" />
    </div>
  );
}

export function BattleProgress({
  total,
  current,
  answered,
}: {
  total: number;
  current: number;
  answered: number[];
}) {
  const count = Math.max(0, total);
  const done = new Set(answered);
  const chunky = count > 0 && count <= 8;
  if (count === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2" role="list" aria-label="Question progress">
        {Array.from({ length: count }, (_, index) => {
          const position = index + 1;
          const isAnswered = done.has(position);
          const isCurrent = position === current;
          const filled = isAnswered || isCurrent;
          return (
            <div
              key={position}
              role="listitem"
              aria-current={isCurrent ? "step" : undefined}
              aria-label={isAnswered ? `Question ${position}, answered` : isCurrent ? `Question ${position}, current` : `Question ${position}`}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center rounded-full",
                chunky ? "h-6" : "h-2.5",
                filled ? "bg-[#0875e4]" : "bg-[#e4e9ef]",
              )}
            >
              {isAnswered && chunky ? <Check className="size-3.5 text-white" strokeWidth={3} aria-hidden /> : null}
            </div>
          );
        })}
      </div>
      <p className="text-center text-sm text-[#8093a7]">Question {Math.max(current, 1)} of {count}</p>
    </div>
  );
}

export function battleCourseLine(
  battle: Pick<Battle, "course" | "courses">,
  courseCode?: string | null,
): { code: string; title: string | null } | null {
  const code = courseCode?.trim() || null;
  const listed = code ? battle.courses?.find((course) => course.code === code) : undefined;
  if (listed) return { code: listed.code, title: listed.title?.trim() || null };
  if (battle.course && (!code || battle.course.code === code)) {
    return { code: battle.course.code, title: battle.course.title?.trim() || null };
  }
  if (!code && battle.courses?.length === 1) {
    const only = battle.courses[0]!;
    return { code: only.code, title: only.title?.trim() || null };
  }
  if (code) return { code, title: null };
  return null;
}

export function BattleCourseStrip({ code, title }: { code: string | null; title: string | null }) {
  if (!code && !title) return null;
  const showTitle = Boolean(title && title !== code);
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-[#eaf3ff] px-4 py-3.5 text-sm text-[#16324c]">
      {code ? <span className="shrink-0 font-bold">{code}</span> : null}
      {code && showTitle ? <span className="h-4 w-px shrink-0 bg-[#d3e0ee]" aria-hidden /> : null}
      {showTitle ? <span className="min-w-0 truncate">{title}</span> : null}
    </div>
  );
}

export function CountdownRing({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const label = seconds < 100 ? String(seconds).padStart(2, "0") : String(seconds);
  const pct = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex flex-col items-center gap-1.5" role="timer" aria-label={`${seconds} seconds left`}>
      <div className="relative size-[76px]">
        <svg viewBox="0 0 76 76" className="size-full -rotate-90" aria-hidden>
          <circle cx="38" cy="38" r={radius} fill="none" stroke="#e6eef6" strokeWidth="5" />
          <circle
            cx="38"
            cy="38"
            r={radius}
            fill="none"
            stroke={ACCENT}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            className="transition-[stroke-dashoffset] duration-300 ease-linear"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[22px] font-bold tabular-nums text-[#0875e4]" aria-hidden>
          {label}
        </span>
      </div>
      <p className="text-xs text-[#8b9caf]">seconds left</p>
    </div>
  );
}

export function LiveBattleBoard({
  participants,
  roundCount,
  position,
  answered,
  courseCode,
  courseTitle,
  prompt,
  promptId,
  headingRef,
  remainingMs,
  totalMs,
  children,
  footer,
}: {
  participants: BattleParticipant[];
  roundCount: number;
  position: number;
  answered: number[];
  courseCode: string | null;
  courseTitle: string | null;
  prompt: string;
  promptId: string;
  headingRef?: Ref<HTMLHeadingElement>;
  remainingMs: number;
  totalMs: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const questionNo = String(position).padStart(2, "0");
  return (
    <div className="flex flex-col gap-4">
      <BattlePlayers participants={participants} />
      <BattleProgress total={roundCount} current={position} answered={answered} />
      <BattleCourseStrip code={courseCode} title={courseTitle} />
      <section className="flex flex-col rounded-[22px] border border-[#e7eef5] bg-white px-4 pb-5 pt-7 shadow-[0_8px_30px_rgba(17,36,60,0.04)] sm:px-5">
        <p className="text-center text-[11px] font-semibold tracking-[0.22em] text-[#9aabbb]">QUESTION {questionNo}</p>
        <h2
          ref={headingRef}
          id={promptId}
          tabIndex={-1}
          className="mt-3 whitespace-pre-wrap text-center text-[26px] font-extrabold leading-[1.25] tracking-[-0.03em] text-ink focus:outline-none"
        >
          {prompt}
        </h2>
        <div className="mt-5 flex justify-center">
          <CountdownRing remainingMs={remainingMs} totalMs={totalMs} />
        </div>
        <div className="mt-6 flex w-full flex-col gap-4">{children}</div>
        {footer ? <div className="mt-5 w-full">{footer}</div> : null}
      </section>
    </div>
  );
}

export function LeaveBattleDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
  error: unknown;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Leave this battle?"
      description={COPY.battle.leaveWarning}
      confirmLabel={loading ? "Leaving…" : "Leave battle"}
      cancelLabel="Stay"
      onConfirm={onConfirm}
      destructive
      loading={loading}
    >
      <InlineError error={error} />
    </ConfirmDialog>
  );
}

export function ReconnectBanner({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <Alert
      tone="warning"
      role="status"
      title={COPY.battle.reconnecting}
      action={
        <Button size="sm" variant="secondary" onClick={onRefresh} loading={refreshing}>
          {refreshing ? null : <RefreshCw className="size-4" aria-hidden />}
          Refresh
        </Button>
      }
    />
  );
}
