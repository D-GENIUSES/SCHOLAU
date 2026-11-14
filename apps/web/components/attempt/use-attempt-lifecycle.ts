"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Attempt, Streak } from "@scholau/api";
import { useHomeSummary, useProfile, useSubmitAttempt } from "@scholau/api/react";
import { useAnalytics } from "@/lib/analytics";
import { emitStreakCelebrationIfAdvanced } from "@/lib/emit-streak-celebration";
import { useServerCountdown } from "@/lib/hooks";

export type RefetchAttempt = () => Promise<{ data: Attempt | undefined }>;

/**
 * Submit + server-derived deadline handling shared by the review and practice/mock players.
 * When the deadline passes we ask the server to finalize (it grades only answers saved in time);
 * the page redirects to results once the cached attempt is no longer active.
 */
export function useAttemptLifecycle(attempt: Attempt, onRefetch: RefetchAttempt) {
  const analytics = useAnalytics();
  const submit = useSubmitAttempt();
  const home = useHomeSummary();
  const profile = useProfile();
  const streakBefore = useRef<Streak | undefined>(home.data?.streak ?? undefined);
  const remaining = useServerCountdown(attempt.expires_at);
  const [deadlineHit, setDeadlineHit] = useState(false);
  const expired = deadlineHit || (attempt.expires_at !== null && remaining <= 0);

  useEffect(() => {
    streakBefore.current = home.data?.streak;
  }, [home.data?.streak]);

  const refreshStreakCelebration = useCallback(() => {
    const previous = streakBefore.current;
    const owner = profile.data?.id;
    void home.refetch().then((result) => {
      const next = result.data?.streak;
      emitStreakCelebrationIfAdvanced(owner, previous, next);
      if (next) streakBefore.current = next;
    });
  }, [home, profile.data?.id]);

  const onFinalized = useCallback(
    (a: Attempt) => {
      analytics.track({ name: "attempt_completed", assessment_kind: a.kind, attempt_id: a.attempt_id, status: a.status });
      if (a.status !== "active") refreshStreakCelebration();
    },
    [analytics, refreshStreakCelebration],
  );

  const { mutate } = submit;
  const attemptId = attempt.attempt_id;
  const finalizeStarted = useRef(false);
  useEffect(() => {
    if (!expired || finalizeStarted.current) return;
    finalizeStarted.current = true;
    mutate({ attemptId }, { onSuccess: onFinalized, onError: () => void onRefetch() });
  }, [expired, mutate, attemptId, onFinalized, onRefetch]);

  const markDeadlinePassed = useCallback(() => setDeadlineHit(true), []);

  return { submit, remaining, expired, onFinalized, markDeadlinePassed };
}
