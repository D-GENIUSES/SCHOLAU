"use client";

import Link from "next/link";
import { Share2 } from "lucide-react";
import { useState } from "react";
import type { Streak } from "@scholau/api";
import { formatNumber } from "@scholau/core";
import { StreakSharePanel } from "@/components/home/streak-share";
import { StreakFlame } from "@/components/icons/streak-flame";
import { StreakWeekGrid } from "@/components/streak/streak-week-grid";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { streakStatusMessage } from "@/lib/streak-week";
import "@/components/lesson/streak-celebration.css";

export function StreakBadge({ streak }: { streak: Streak }) {
  const [open, setOpen] = useState(false);
  const [shareView, setShareView] = useState(false);
  const { current, active_today: activeToday } = streak;

  function closeDialog() {
    setOpen(false);
    setShareView(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setShareView(false);
      }}
    >
      <button
        type="button"
        className="header-streak"
        data-active={activeToday}
        aria-label={`${current}-day streak${activeToday ? ", active today" : ""}. View streak details`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <StreakFlame active={activeToday} size={22} />
        <span key={current} className="streak-count">
          {current}
        </span>
      </button>
      <DialogContent className="streak-info-dialog">
        {shareView ? (
          <>
            <DialogTitle>Share your streak</DialogTitle>
            <DialogDescription>
              You showed up for {current} {current === 1 ? "day" : "days"}. Let your friends see your progress.
            </DialogDescription>
            <StreakSharePanel days={current} active={open && shareView} />
            <Button variant="ghost" className="w-full" onClick={() => setShareView(false)}>
              Back to streak
            </Button>
          </>
        ) : (
          <>
            <div className="streak-info-hero" aria-hidden="true">
              <StreakFlame active={activeToday || current > 0} size={72} />
            </div>
            <DialogTitle className="streak-info-title">
              <span className="streak-info-count">{formatNumber(current)}</span>
              <span className="streak-info-label">{current === 1 ? "day streak" : "days streak"}</span>
            </DialogTitle>
            <DialogDescription className="text-center">{streakStatusMessage(streak)}</DialogDescription>
            <StreakWeekGrid streak={streak} />
            <dl className="streak-info-stats">
              <div>
                <dt>Longest streak</dt>
                <dd>
                  {formatNumber(streak.longest)} {streak.longest === 1 ? "day" : "days"}
                </dd>
              </div>
            </dl>
            <div className="flex w-full flex-wrap items-center justify-center gap-2">
              <Button asChild className="min-w-[10rem] flex-1">
                <Link href="/home" onClick={closeDialog}>
                  {current > 0 && !activeToday ? "Keep streak going" : "Start learning"}
                </Link>
              </Button>
              {current > 0 ? (
                <Button variant="outline" size="icon" aria-label="Share your streak" onClick={() => setShareView(true)}>
                  <Share2 aria-hidden />
                </Button>
              ) : null}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
