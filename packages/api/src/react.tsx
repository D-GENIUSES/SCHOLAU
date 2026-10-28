"use client";

import {
  type QueryClient,
  type UseMutationOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { isLiveBattleState, type LeaderboardScope } from "@scholau/core";
import { newRequestKey, type ScholauApi } from "./client";
import { ScholauApiError } from "./errors";
import { qk } from "./query-keys";
import { type ChannelStatus, subscribeToSignals, topics } from "./realtime";
import type * as T from "./types";

/* ------------------------------------------------------------------------------------------------ */
/* Provider                                                                                         */
/* ------------------------------------------------------------------------------------------------ */

const ApiContext = createContext<ScholauApi | null>(null);

export function ScholauApiProvider({ api, children }: { api: ScholauApi; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useScholauApi(): ScholauApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useScholauApi must be used inside <ScholauApiProvider>");
  return api;
}

/** Retry only transport failures and explicitly retryable codes (never STALE_REVISION blindly). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ScholauApiError) {
    return error.code === "NETWORK" || error.code === "RATE_LIMITED" || error.code === "MAINTENANCE" || (error.code === "UNKNOWN" && error.retryable);
  }
  return false;
}

export const retryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 8000);

/* ------------------------------------------------------------------------------------------------ */
/* Keyed mutations: one request key per user intent, reused by automatic and manual retries.        */
/* ------------------------------------------------------------------------------------------------ */

type WithKey<V> = V & { requestKey: string };
type MaybeKey<V> = V & { requestKey?: string };

export function useKeyedMutation<V extends object, R>(
  fn: (vars: WithKey<V>) => Promise<R>,
  options: Omit<UseMutationOptions<R, ScholauApiError, WithKey<V>>, "mutationFn"> = {},
) {
  const m = useMutation<R, ScholauApiError, WithKey<V>>({ mutationFn: fn, retry: shouldRetry, retryDelay, ...options });
  const { mutate: rawMutate, mutateAsync: rawMutateAsync } = m;
  const attach = (v: MaybeKey<V>): WithKey<V> => ({ ...v, requestKey: v.requestKey ?? newRequestKey() }) as WithKey<V>;
  const mutate = useCallback(
    (v: MaybeKey<V>, o?: Parameters<typeof rawMutate>[1]) => rawMutate(attach(v), o),
    [rawMutate],
  );
  const mutateAsync = useCallback(
    (v: MaybeKey<V>, o?: Parameters<typeof rawMutateAsync>[1]) => rawMutateAsync(attach(v), o),
    [rawMutateAsync],
  );
  /** Retry the last intent with the *same* request key. */
  const retryLast = useCallback(() => {
    if (m.variables) rawMutate(m.variables);
  }, [rawMutate, m.variables]);
  return { ...m, mutate, mutateAsync, retryLast };
}

function usePlainMutation<V, R>(
  fn: (vars: V) => Promise<R>,
  options: Omit<UseMutationOptions<R, ScholauApiError, V>, "mutationFn"> = {},
) {
  return useMutation<R, ScholauApiError, V>({ mutationFn: fn, retry: shouldRetry, retryDelay, ...options });
}

function invalidate(qc: QueryClient, ...keys: readonly (readonly unknown[])[]) {
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

/* ------------------------------------------------------------------------------------------------ */
/* Profile, onboarding, home                                                                        */
/* ------------------------------------------------------------------------------------------------ */

export function useProfile(enabled = true) {
  const api = useScholauApi();
  return useQuery({ queryKey: qk.profile(), queryFn: api.getMyProfile, enabled, retry: shouldRetry });
}

export function useHomeSummary() {
  const api = useScholauApi();
  return useQuery({ queryKey: qk.home(), queryFn: api.getHomeSummary, retry: shouldRetry });
}

export function useOnboardingOptions(universityId?: string | null, facultyId?: string | null, academicPeriodId?: string | null) {
  const api = useScholauApi();
  return useQuery({
    queryKey: qk.onboarding(universityId, facultyId, academicPeriodId),
    queryFn: () => api.getOnboardingOptions({ universityId, facultyId, academicPeriodId }),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60_000,
    retry: shouldRetry,
  });
}

export function useUpdateProfile() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return usePlainMutation(api.updateProfile, {
    onSuccess: (data) => {
      qc.setQueryData(qk.profile(), data);
      void invalidate(qc, qk.home(), ["scholau", "leaderboard"], ["scholau", "social"]);
    },
  });
}

export function useSetAcademicProfile() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.setAcademicProfile, {
    onSuccess: (data) => {
      qc.setQueryData(qk.profile(), data);
      void invalidate(qc, qk.home(), qk.catalog(), ["scholau", "leaderboard"]);
    },
  });
}

/* ------------------------------------------------------------------------------------------------ */
/* Catalog & study                                                                                  */
/* ------------------------------------------------------------------------------------------------ */

export function useCatalog() {
  const api = useScholauApi();
  return useQuery({ queryKey: qk.catalog(), queryFn: api.getCatalog, retry: shouldRetry });
}

export function useEnrollCourse() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.enrollCourse, {
    onSuccess: () => void invalidate(qc, qk.catalog(), qk.home()),
  });
}

export function useCourseOverview(offeringId: string | undefined) {
  const api = useScholauApi();
  return useQuery({
    queryKey: qk.course(offeringId ?? ""),
    queryFn: () => api.getCourseOverview(offeringId!),
    enabled: Boolean(offeringId),
    retry: shouldRetry,
  });
}

export function useLesson(lessonId: string | undefined) {
  const api = useScholauApi();
  return useQuery({
    queryKey: qk.lesson(lessonId ?? ""),
    queryFn: () => api.getLesson(lessonId!),
    enabled: Boolean(lessonId),
    retry: shouldRetry,
  });
}

export function useStartLesson() {
  const api = useScholauApi();
  return usePlainMutation(api.startLesson);
}

export function useCompleteLesson({ firstLessonCelebrationMs = 0 }: { firstLessonCelebrationMs?: number } = {}) {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.completeLesson, {
    onSuccess: (result) => {
      const refreshProgress = () => {
        // Use the confirmed server value; never increment a streak on the client.
        qc.setQueryData<T.HomeSummary>(qk.home(), (previous) => previous ? {
          ...previous, streak: result.streak, xp_total: result.xp_total ?? previous.xp_total,
        } : previous);
        qc.setQueryData<T.Profile>(qk.profile(), (previous) => previous ? {
          ...previous, streak: result.streak, xp_total: result.xp_total ?? previous.xp_total,
        } : previous);
        void invalidate(qc, qk.home(), qk.profile());
      };
      void invalidate(qc, ["scholau", "lesson"], ["scholau", "course"], qk.catalog());
      if ((result.streak_advanced || result.first_lesson_completed) && !result.already_completed && firstLessonCelebrationMs > 0) {
        // Cache refresh must still run if the learner navigates away during the animation.
        setTimeout(refreshProgress, firstLessonCelebrationMs);
      } else refreshProgress();
    },
  });
}

/* ------------------------------------------------------------------------------------------------ */
/* Assessments                                                                                      */
/* ------------------------------------------------------------------------------------------------ */

export function useAttempt(attemptId: string | undefined, options: { refetchInterval?: number | false } = {}) {
  const api = useScholauApi();
  return useQuery({
    queryKey: qk.attempt(attemptId ?? ""),
    queryFn: () => api.getAttempt(attemptId!),
    enabled: Boolean(attemptId),
    retry: shouldRetry,
    refetchInterval: options.refetchInterval,
    // Local answer state lives in the attempt view; do not clobber it while the user is answering.
    refetchOnWindowFocus: false,
  });
}

export function useStartAttempt() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.startAttempt, {
    onSuccess: (data) => {
      qc.setQueryData(qk.attempt(data.attempt_id), data);
      void invalidate(qc, ["scholau", "course"]);
    },
  });
}

export function useSaveAttemptAnswers() {
  const api = useScholauApi();
  return useKeyedMutation(api.saveAttemptAnswers);
}

export function useCheckReviewAnswer() {
  const api = useScholauApi();
  return useKeyedMutation(api.checkReviewAnswer);
}

export function useSubmitAttempt() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.submitAttempt, {
    onSuccess: (data) => {
      qc.setQueryData(qk.attempt(data.attempt_id), data);
      void invalidate(qc, ["scholau", "course"], qk.home(), qk.profile(), ["scholau", "xp"], ["scholau", "leaderboard"]);
    },
  });
}

/* ------------------------------------------------------------------------------------------------ */
/* Reports & notifications                                                                          */
/* ------------------------------------------------------------------------------------------------ */

export function useReportContent() {
  const api = useScholauApi();
  return useKeyedMutation(api.reportContent);
}

export function useNotifications(enabled = true) {
  const api = useScholauApi();
  return useQuery({ queryKey: qk.notifications(), queryFn: () => api.listNotifications(), enabled, retry: shouldRetry });
}

export function useMarkNotificationRead() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return usePlainMutation(api.markNotificationRead, {
    onSuccess: () => void invalidate(qc, qk.notifications(), qk.home()),
  });
}

export function useClearNotifications() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return usePlainMutation(api.clearNotifications, {
    onSuccess: () => void invalidate(qc, qk.notifications(), qk.home()),
  });
}

/* ------------------------------------------------------------------------------------------------ */
/* Battles                                                                                          */
/* ------------------------------------------------------------------------------------------------ */

export function useMyLiveBattle(options: { refetchInterval?: number | false } = {}) {
  const api = useScholauApi();
  return useQuery({
    queryKey: qk.liveBattle(),
    queryFn: api.getMyLiveBattle,
    retry: shouldRetry,
    refetchInterval: options.refetchInterval,
  });
}

/**
 * Authoritative battle state. Realtime broadcasts only trigger refetches; while the channel is not
 * connected (or a transition is due) we poll boundedly.
 */
export function useBattleState(battleId: string | undefined, channelStatus: ChannelStatus = "connected") {
  const api = useScholauApi();
  return useQuery({
    queryKey: qk.battle(battleId ?? ""),
    queryFn: () => api.getBattleState(battleId!),
    enabled: Boolean(battleId),
    retry: shouldRetry,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      if (!isLiveBattleState(data.state)) return false;
      return channelStatus === "connected" ? 5000 : 1500;
    },
    refetchIntervalInBackground: false,
  });
}

/** Subscribes to `battle:<id>`; every broadcast triggers a refetch of get_battle_state_v1. */
export function useBattleSignals(battleId: string | undefined): ChannelStatus {
  const api = useScholauApi();
  const qc = useQueryClient();
  const [status, setStatus] = useState<ChannelStatus>("connecting");
  useEffect(() => {
    if (!battleId) return;
    const sub = subscribeToSignals(api.supabase, topics.battle(battleId), {
      onSignal: () => void qc.invalidateQueries({ queryKey: qk.battle(battleId) }),
      onStatus: setStatus,
    });
    return () => sub.unsubscribe();
  }, [api, qc, battleId]);
  return status;
}

/** Subscribes to `user:<id>` for match, attempt and inbox signals; refetches authoritative state. */
export function useUserSignals(userId: string | undefined): ChannelStatus {
  const api = useScholauApi();
  const qc = useQueryClient();
  const [status, setStatus] = useState<ChannelStatus>("connecting");
  const inboxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!userId) return;
    const sub = subscribeToSignals(api.supabase, topics.user(userId), {
      onSignal: (event) => {
        if (event === "friends_changed" || event === "resync") void qc.invalidateQueries({ queryKey: ["scholau", "social"] });
        if (event === "battle_invitation" || event === "resync") {
          void qc.invalidateQueries({ queryKey: ["scholau", "social", "invitations"] });
          void qc.invalidateQueries({ queryKey: qk.notifications() });
          void qc.invalidateQueries({ queryKey: qk.home() });
        }
        if (event === "battle_matched" || event === "resync") void qc.invalidateQueries({ queryKey: qk.liveBattle() });
        if (event === "attempt_finalized" || event === "resync") void qc.invalidateQueries({ queryKey: ["scholau", "attempt"] });
        if (event === "attempt_finalized" || event === "resync") void invalidate(qc, ["scholau", "xp"], qk.profile(), qk.home(), ["scholau", "leaderboard"]);
        if (event === "notification" || event === "resync") {
          // A fan-out can emit many signals; one refetch updates the bell and the inbox.
          if (inboxTimer.current) clearTimeout(inboxTimer.current);
          inboxTimer.current = setTimeout(() => {
            inboxTimer.current = null;
            void invalidate(qc, qk.notifications(), qk.home());
          }, event === "resync" ? 0 : 80);
        }
      },
      onStatus: setStatus,
    });
    return () => {
      sub.unsubscribe();
      if (inboxTimer.current) clearTimeout(inboxTimer.current);
    };
  }, [api, qc, userId]);
  return status;
}

export function useCreateDirectBattle() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.createDirectBattle, {
    onSuccess: (data) => {
      qc.setQueryData(qk.battle(data.battle_id), data);
      void invalidate(qc, qk.liveBattle(), qk.home());
    },
  });
}

export function useAcceptBattle() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.acceptBattle, {
    onSuccess: (data) => {
      qc.setQueryData(qk.battle(data.battle_id), data);
      void invalidate(qc, qk.liveBattle(), qk.home(), ["scholau", "social", "invitations"]);
    },
  });
}

export function useJoinQueue() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.joinQueue, { onSuccess: () => void invalidate(qc, qk.liveBattle(), qk.home()) });
}

export function useLeaveQueue() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return usePlainMutation((_: void) => api.leaveQueue(), { onSuccess: () => void invalidate(qc, qk.liveBattle(), qk.home()) });
}

export function useReadyBattle() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.readyBattle, { onSuccess: (data) => qc.setQueryData(qk.battle(data.battle_id), data) });
}

export function useSubmitBattleAnswer() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.submitBattleAnswer, {
    onSettled: (_d, _e, v) => void qc.invalidateQueries({ queryKey: qk.battle(v.battleId) }),
  });
}

export function useForfeitBattle() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.forfeitBattle, {
    onSuccess: (data) => {
      qc.setQueryData(qk.battle(data.battle_id), data);
      void invalidate(qc, qk.liveBattle(), qk.battles(), qk.home());
    },
  });
}

export function useBattleHistory() {
  const api = useScholauApi();
  return useInfiniteQuery({
    queryKey: qk.battles(),
    queryFn: ({ pageParam }) => api.getMyBattles({ before: pageParam, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: T.BattleHistoryPage) => last.next_before ?? undefined,
    retry: shouldRetry,
  });
}

export function useLeaderboard(scope: LeaderboardScope) {
  const api = useScholauApi();
  return useInfiniteQuery({
    queryKey: qk.leaderboard(scope),
    queryFn: ({ pageParam }) => api.getLeaderboard({ scope, cursor: pageParam, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: T.LeaderboardPage) => last.next_cursor ?? undefined,
    retry: shouldRetry,
  });
}

export function useAppConfig() {
  const api = useScholauApi();
  return useQuery({ queryKey: qk.appConfig(), queryFn: () => api.getAppConfig("web"), staleTime: 5 * 60_000, retry: false });
}

/* ------------------------------------------------------------------------------------------------ */
/* Admin                                                                                            */
/* ------------------------------------------------------------------------------------------------ */

export function useAdminCounts() {
  const api = useScholauApi();
  return useQuery({ queryKey: qk.admin.counts(), queryFn: api.admin.countContent, retry: shouldRetry });
}

export function useAdminReports(state?: string | null) {
  const api = useScholauApi();
  return useQuery({ queryKey: qk.admin.reports(state), queryFn: () => api.admin.listReports(state), retry: shouldRetry });
}

export function useAdminOfferings() {
  const api = useScholauApi();
  return useQuery({ queryKey: qk.admin.offerings(), queryFn: api.admin.listOfferings, retry: shouldRetry });
}

export function useAdminLessonVersions(status?: string | null) {
  const api = useScholauApi();
  return useQuery({ queryKey: qk.admin.lessons(status), queryFn: () => api.admin.listLessonVersions(status), retry: shouldRetry });
}

export function useMaterialIngestionJob(jobId: string | null) {
  return useQuery({
    queryKey: qk.materialIngestion(jobId),
    enabled: Boolean(jobId),
    retry: shouldRetry,
    refetchInterval: (query) => {
      const status = (query.state.data as T.MaterialIngestionJobStatus | undefined)?.status;
      return status === "pending" || status === "processing" ? 3000 : false;
    },
    queryFn: async () => {
      const res = await fetch(`/api/material-ingestion?jobId=${encodeURIComponent(jobId!)}`, { credentials: "same-origin" });
      if (!res.ok) throw new ScholauApiError({ code: "NETWORK", message: "Could not load ingestion job.", retryable: true });
      return (await res.json()) as T.MaterialIngestionJobStatus;
    },
  });
}

export function useAdminIngestionEvidence(sourceReference: string | null | undefined) {
  const api = useScholauApi();
  return useQuery({
    queryKey: qk.admin.ingestionEvidence(sourceReference ?? ""),
    queryFn: () => api.admin.getIngestionEvidence(sourceReference!),
    enabled: Boolean(sourceReference?.includes("SHA-256")),
    retry: shouldRetry,
  });
}

export function useAdminQuestionVersions(status?: string | null) {
  const api = useScholauApi();
  return useQuery({ queryKey: qk.admin.questions(status), queryFn: () => api.admin.listQuestionVersions(status), retry: shouldRetry });
}

export function useAdminAssessmentVersions(status?: string | null) {
  const api = useScholauApi();
  return useQuery({
    queryKey: qk.admin.assessments(status),
    queryFn: () => api.admin.listAssessmentVersions(status),
    retry: shouldRetry,
  });
}

export function useAdminQuestion(questionVersionId: string | undefined) {
  const api = useScholauApi();
  return useQuery({
    queryKey: qk.admin.question(questionVersionId ?? ""),
    queryFn: () => api.admin.getQuestion(questionVersionId!),
    enabled: Boolean(questionVersionId),
    retry: shouldRetry,
  });
}

export function useAdminBattles(state?: string | null) {
  const api = useScholauApi();
  return useQuery({ queryKey: qk.admin.battles(state), queryFn: () => api.admin.listBattles(state), retry: shouldRetry });
}

export function useAdminEntitlements() {
  const api = useScholauApi();
  return useQuery({ queryKey: qk.admin.entitlements(), queryFn: api.admin.listEntitlements, retry: shouldRetry });
}

export function useAdminAudit(entityType?: string | null) {
  const api = useScholauApi();
  return useInfiniteQuery({
    queryKey: qk.admin.audit(entityType),
    queryFn: ({ pageParam }) => api.admin.listAudit({ entityType, before: pageParam, limit: 50 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: T.AuditPage) => (last.items.length === 50 ? last.items[last.items.length - 1]?.created_at : undefined),
    retry: shouldRetry,
  });
}

export function useAdminPublish() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.admin.publish, { onSuccess: () => void invalidate(qc, qk.admin.all) });
}

export function useAdminRetire() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.admin.retire, { onSuccess: () => void invalidate(qc, qk.admin.all) });
}

export function useAdminImport(kind: "questions" | "lessons") {
  const api = useScholauApi();
  const qc = useQueryClient();
  return usePlainMutation(
    (v: { rows: Record<string, unknown>[]; dryRun: boolean; requestKey?: string }) =>
      kind === "questions" ? api.admin.importQuestions(v) : api.admin.importLessons(v),
    { onSuccess: (r) => (r.dry_run ? undefined : void invalidate(qc, qk.admin.all)) },
  );
}

export function useAdminTriageReport() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.admin.triageReport, { onSuccess: () => void invalidate(qc, ["scholau", "admin", "reports"], qk.admin.counts()) });
}

export function useAdminCorrectResult() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.admin.correctResult, { onSuccess: () => void invalidate(qc, ["scholau", "admin", "battles"]) });
}

export function useAdminGrantPremium() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.admin.grantPremium, { onSuccess: () => void invalidate(qc, qk.admin.entitlements()) });
}

export function useAdminRevokePremium() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.admin.revokePremium, { onSuccess: () => void invalidate(qc, qk.admin.entitlements()) });
}

export function useAdminSetRole() {
  const api = useScholauApi();
  return useKeyedMutation(api.admin.setRole);
}

export function useAdminUpsertAssessmentDraft() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.admin.upsertAssessmentDraft, { onSuccess: () => void invalidate(qc, qk.admin.all) });
}

export type { ChannelStatus };

export function useXpProgress() {
  const api = useScholauApi();
  return useQuery({ queryKey: ["scholau", "xp"], queryFn: api.getXpProgress, retry: shouldRetry, staleTime: 30_000 });
}

export function useStartTopicReview() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useKeyedMutation(api.startTopicReview, {
    onSuccess: (data) => { qc.setQueryData(qk.attempt(data.attempt_id), data); },
  });
}

export function usePublicProfile(userId: string) {
  const api = useScholauApi();
  return useQuery({ queryKey: ["scholau", "social", "public-profile", userId], queryFn: () => api.getPublicProfile(userId), retry: shouldRetry });
}

export function useFriends() {
  const api = useScholauApi();
  return useQuery({ queryKey: ["scholau", "social", "friends"], queryFn: api.getFriends, retry: shouldRetry, refetchInterval: 15000 });
}
export function useSearchFriends(query: string) {
  const api = useScholauApi();
  return useQuery({ queryKey: ["scholau", "social", "search", query], queryFn: () => api.searchFriends(query), enabled: query.length >= 3, retry: shouldRetry });
}
export function useFriendAction() {
  const api = useScholauApi(); const qc = useQueryClient();
  return usePlainMutation(api.friendAction, { onSuccess: () => { void qc.invalidateQueries({ queryKey: ["scholau", "social"] }); } });
}
export function useSetFriendUsername() {
  const api = useScholauApi(); const qc = useQueryClient();
  return usePlainMutation(api.setFriendUsername, { onSuccess: () => { void invalidate(qc, qk.profile(), qk.home(), ["scholau", "social"], ["scholau", "leaderboard"]); } });
}
export function useBattleSetup(friendId?: string | null) {
  const api = useScholauApi();
  return useQuery({ queryKey: ["scholau", "social", "setup", friendId ?? null], queryFn: () => api.getBattleSetup(friendId), retry: shouldRetry });
}
export function useBattleInvitations() {
  const api = useScholauApi();
  return useQuery({ queryKey: ["scholau", "social", "invitations"], queryFn: api.getBattleInvitations, refetchInterval: 10000, retry: shouldRetry });
}
export function useDeclineBattleInvitation() {
  const api = useScholauApi(); const qc = useQueryClient();
  return usePlainMutation(api.declineBattleInvitation, { onSuccess: () => { void qc.invalidateQueries({ queryKey: ["scholau", "social", "invitations"] }); } });
}
export function useBattleInvitePreview(token: string) {
  const api = useScholauApi();
  return useQuery({ queryKey: ["scholau", "social", "preview", token], queryFn: () => api.getBattleInvitePreview(token), retry: shouldRetry });
}


export function useNotificationSettings() {
  const api = useScholauApi();
  return useQuery({ queryKey: ["scholau", "notification-settings"], queryFn: () => api.getNotificationSettings(), retry: shouldRetry });
}
export function useUpdateNotificationPreferences() {
  const api = useScholauApi();
  const qc = useQueryClient();
  return useMutation({ mutationFn: (preferences: T.NotificationPreferences) => api.updateNotificationPreferences(preferences),
    onSuccess: (result) => qc.setQueryData(["scholau", "notification-settings"], result) });
}
