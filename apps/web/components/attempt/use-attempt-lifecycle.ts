"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Attempt } from "@scholau/api";
import { useSubmitAttempt } from "@scholau/api/react";
import { useAnalytics } from "@/lib/analytics";
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
  const remaining = useServerCountdown(attempt.expires_at);
  const [deadlineHit, setDeadlineHit] = useState(false);
  const expired = deadlineHit || (attempt.expires_at !== null && remaining <= 0);

  const onFinalized = useCallback(
    (a: Attempt) => analytics.track({ name: "attempt_completed", assessment_kind: a.kind, attempt_id: a.attempt_id, status: a.status }),
    [analytics],
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
