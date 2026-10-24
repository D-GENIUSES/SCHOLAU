import type { SupabaseClient } from "@supabase/supabase-js";
import { type AdminEntityType, type LeaderboardScope, type ReportCategory, type ReportTargetType, ServerClock, serverClock } from "@scholau/core";
import { parseRpcError, ScholauApiError } from "./errors";
import type * as T from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabaseClient = SupabaseClient<any, any, any>;

export interface ScholauApiOptions {
  /** Observes `server_time` from every response to derive countdowns. */
  clock?: ServerClock;
}

/** UUID v4 request key. Generate once per user intent; reuse it for retries of the same intent. */
export function newRequestKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // RFC4122 v4 fallback
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Headers for `x-client-*` compatibility checks (assert_client_supported). */
export function clientHeaders(platform: "web" | "ios" | "android", build?: number, apiVersion = 1): Record<string, string> {
  const h: Record<string, string> = { "x-client-platform": platform, "x-api-version": String(apiVersion) };
  if (build && Number.isFinite(build)) h["x-client-build"] = String(build);
  return h;
}

type Keyed<A> = A & { requestKey: string };

/**
 * Typed adapter over the ScholAu RPC surface. Receives an injected Supabase client (browser, SSR or
 * Expo). One function per granted RPC. Mutations require a request key (see `newRequestKey`).
 */
export function createScholauApi(supabase: AnySupabaseClient, options: ScholauApiOptions = {}) {
  const clock = options.clock ?? serverClock;

  async function rpc<R>(fn: string, args?: Record<string, unknown>): Promise<R> {
    let res;
    try {
      res = await supabase.rpc(fn, args ?? {});
    } catch (err) {
      throw parseRpcError(err);
    }
    if (res.error) throw parseRpcError(res.error, res.status);
    const data = res.data as R & { server_time?: string };
    if (data && typeof data === "object" && "server_time" in data) clock.observe(data.server_time);
    return data;
  }

  async function select<R>(query: PromiseLike<{ data: unknown; error: unknown; status?: number }>): Promise<R> {
    let res;
    try {
      res = await query;
    } catch (err) {
      throw parseRpcError(err);
    }
    if (res.error) throw parseRpcError(res.error, res.status);
    return res.data as R;
  }

  return {
    supabase,
    clock,

    /* ---------------------------------- Profile & onboarding ---------------------------------- */
    getPublicProfile: (userId: string) => rpc<T.PublicProfile>("get_public_profile_v1", { p_user_id: userId }),
    getMyProfile: () => rpc<T.Profile>("get_my_profile_v1"),
    updateProfile: (a: { username?: string; displayName?: string; avatarPath?: string; clearAvatar?: boolean; leaderboardVisible?: boolean }) =>
      rpc<T.Profile>("update_profile_v2", {
        p_username: a.username ?? null,
        p_display_name: a.displayName ?? null,
        p_avatar_path: a.avatarPath ?? null,
        p_clear_avatar: a.clearAvatar ?? false,
        p_leaderboard_visible: a.leaderboardVisible ?? null,
      }),
    getOnboardingOptions: (a: { universityId?: string | null; facultyId?: string | null; academicPeriodId?: string | null } = {}) =>
      rpc<T.OnboardingOptions>("get_onboarding_options_v1", {
        p_university_id: a.universityId ?? null,
        p_faculty_id: a.facultyId ?? null,
        p_academic_period_id: a.academicPeriodId ?? null,
      }),
    setAcademicProfile: (
      a: Keyed<{
        universityId: string;
        facultyId: string;
        departmentId: string;
        levelId: string;
        academicPeriodId: string;
        semesterId: string;
      }>,
    ) =>
      rpc<T.Profile>("set_academic_profile_v1", {
        p_university_id: a.universityId,
        p_faculty_id: a.facultyId,
        p_department_id: a.departmentId,
        p_level_id: a.levelId,
        p_academic_period_id: a.academicPeriodId,
        p_semester_id: a.semesterId,
        p_request_key: a.requestKey,
      }),

    /* ------------------------------------ Catalog & study ------------------------------------- */
    getCatalog: () => rpc<T.Catalog>("get_catalog_v1"),
    enrollCourse: (a: Keyed<{ offeringId: string }>) =>
      rpc<T.Enrollment>("enroll_course_v1", { p_offering_id: a.offeringId, p_request_key: a.requestKey }),
    getCourseOverview: (offeringId: string) => rpc<T.CourseOverview>("get_course_overview_v1", { p_offering_id: offeringId }),
    getLesson: (lessonId: string) => rpc<T.Lesson>("get_lesson_v1", { p_lesson_id: lessonId }),
    startLesson: (lessonVersionId: string) =>
      rpc<T.LessonProgressResult>("start_lesson_v1", { p_lesson_version_id: lessonVersionId }),
    completeLesson: (a: Keyed<{ lessonVersionId: string }>) =>
      rpc<T.CompleteLessonResult>("complete_lesson_v1", { p_lesson_version_id: a.lessonVersionId, p_request_key: a.requestKey }),
    getHomeSummary: () => rpc<T.HomeSummary>("get_home_summary_v1"),
    getXpProgress: () => rpc<T.XpProgress>("get_xp_progress_v1"),
    startTopicReview: (a: Keyed<{ lessonId: string; stage: number }>) => rpc<T.Attempt>("start_topic_review_v1", {
      p_lesson_id: a.lessonId, p_stage: a.stage, p_request_key: a.requestKey,
    }),

    /* -------------------------------------- Assessments --------------------------------------- */
    startAttempt: (a: Keyed<{ assessmentVersionId: string; resume?: boolean; questionCount?: number; durationSeconds?: number | null }>) =>
      a.questionCount !== undefined ? rpc<T.Attempt>("start_configured_attempt_v1", {
        p_assessment_version_id: a.assessmentVersionId,
        p_request_key: a.requestKey,
        p_question_count: a.questionCount,
        p_duration_seconds: a.durationSeconds ?? null,
        p_resume: a.resume ?? true,
      }) : rpc<T.Attempt>("start_attempt_v1", {
        p_assessment_version_id: a.assessmentVersionId,
        p_request_key: a.requestKey,
        p_resume: a.resume ?? true,
      }),
    saveAttemptAnswers: (a: Keyed<{ attemptId: string; answers: T.AnswerInput[] }>) =>
      rpc<T.SaveAnswersResult>("save_attempt_answers_v1", {
        p_attempt_id: a.attemptId,
        p_answers: a.answers,
        p_request_key: a.requestKey,
      }),
    checkReviewAnswer: (a: Keyed<{ attemptId: string; questionVersionId: string; optionId: string }>) =>
      rpc<T.ReviewCheckResult>("check_review_answer_v1", {
        p_attempt_id: a.attemptId,
        p_question_version_id: a.questionVersionId,
        p_option_id: a.optionId,
        p_request_key: a.requestKey,
      }),
    submitAttempt: (a: Keyed<{ attemptId: string; answers?: T.AnswerInput[] }>) =>
      rpc<T.Attempt>("submit_attempt_v1", {
        p_attempt_id: a.attemptId,
        p_answers: a.answers ?? null,
        p_request_key: a.requestKey,
      }),
    /** Owner view of an attempt (active or finalized) according to the feedback policy. */
    getAttempt: (attemptId: string) => rpc<T.Attempt>("get_attempt_result_v1", { p_attempt_id: attemptId }),

    /* ----------------------------------- Reports & notices ------------------------------------ */
    reportContent: (a: Keyed<{ targetType: ReportTargetType; targetId?: string | null; category: ReportCategory; note: string }>) =>
      rpc<T.ReportReceipt>("report_content_v1", {
        p_target_type: a.targetType,
        p_target_id: a.targetId ?? null,
        p_category: a.category,
        p_note: a.note,
        p_request_key: a.requestKey,
      }),
    markNotificationRead: (a: { notificationId?: string; all?: boolean }) =>
      rpc<T.NotificationReadResult>("mark_notification_read_v1", {
        p_notification_id: a.notificationId ?? null,
        p_all: a.all ?? false,
      }),
    clearNotifications: () => rpc<T.NotificationClearResult>("clear_my_notifications_v1"),
    getNotificationSettings: () => rpc<T.NotificationSettingsResult>("get_notification_preferences_v1"),
    updateNotificationPreferences: (preferences: T.NotificationPreferences) =>
      rpc<T.NotificationSettingsResult>("update_notification_preferences_v1", { p_preferences: preferences }),
    getAnnouncementAudiences: () => rpc<T.AnnouncementAudienceResult>("get_announcement_audiences_v1"),
    previewAnnouncement: (a: { audience: T.AnnouncementInput["audience"]; audienceId: string | null }) =>
      rpc<T.Envelope & { recipient_count: number }>("preview_announcement_v1", { p_audience: a.audience, p_audience_id: a.audienceId }),
    sendAnnouncement: (a: T.AnnouncementInput) => rpc<T.AnnouncementReceipt>("send_announcement_v1", {
      p_title: a.title, p_body: a.body, p_target: a.target, p_audience: a.audience, p_audience_id: a.audienceId, p_request_key: a.requestKey,
    }),
    getPushHealth: () => rpc<T.PushHealth>("admin_push_health_v1"),
    listNotifications: (limit = 30) =>
      select<T.Notification[]>(
        supabase
          .from("notifications")
          .select("id, kind, body, safe_target, read_at, created_at, expires_at")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(limit),
      ),

    /* ---------------------------------------- Battles ----------------------------------------- */
    createDirectBattle: (a: Keyed<{ offeringId: string; offeringIds?: string[]; questionCount?: number; friendId?: string | null }>) =>
      rpc<T.BattleState_>("create_scoped_battle_v1", { p_offering_ids: a.offeringIds ?? [a.offeringId], p_question_count: a.questionCount ?? 10, p_friend_id: a.friendId ?? null, p_request_key: a.requestKey }),
    getFriends: () => rpc<T.FriendsState>("get_friends_v1"),
    searchFriends: (query: string) => rpc<T.Envelope & { people: T.FriendPerson[] }>("search_friends_v1", { p_query: query }),
    friendAction: (a: { userId: string; action: T.FriendAction }) => rpc<T.FriendsState>("friend_action_v1", { p_user_id: a.userId, p_action: a.action }),
    setFriendUsername: (username: string) => rpc<T.FriendsState>("set_friend_username_v1", { p_username: username }),
    getBattleSetup: (friendId?: string | null) => rpc<T.BattleSetup>("get_battle_setup_v1", { p_friend_id: friendId ?? null }),
    getBattleInvitations: () => rpc<T.BattleInvitations>("get_battle_invitations_v1"),
    getBattleInvitePreview: (token: string) => rpc<T.Envelope & { round_count: number; courses: string[] }>("get_battle_invite_preview_v1", { p_invite_token: token }),
    declineBattleInvitation: (battleId: string) => rpc<T.Envelope>("decline_battle_invitation_v1", { p_battle_id: battleId }),
    acceptBattle: (a: Keyed<{ inviteToken: string }>) =>
      rpc<T.BattleState_>("accept_battle_v1", { p_invite_token: a.inviteToken, p_request_key: a.requestKey }),
    joinQueue: (a: Keyed<{ offeringId: string }>) =>
      rpc<T.JoinQueueResult>("join_queue_v1", { p_offering_id: a.offeringId, p_request_key: a.requestKey }),
    leaveQueue: () => rpc<T.LeaveQueueResult>("leave_queue_v1"),
    getMyLiveBattle: () => rpc<T.LiveBattle>("get_my_live_battle_v1"),
    readyBattle: (a: Keyed<{ battleId: string }>) =>
      rpc<T.BattleState_>("ready_battle_v1", { p_battle_id: a.battleId, p_request_key: a.requestKey }),
    getBattleState: (battleId: string) => rpc<T.BattleState_>("get_battle_state_v1", { p_battle_id: battleId }),
    submitBattleAnswer: (a: Keyed<{ battleId: string; position: number; optionId?: string | null; textAnswer?: string | null }>) =>
      rpc<T.BattleAnswerAck>("submit_battle_answer_v1", {
        p_battle_id: a.battleId,
        p_position: a.position,
        p_option_id: a.optionId ?? null,
        p_text_answer: a.textAnswer ?? null,
        p_request_key: a.requestKey,
      }),
    forfeitBattle: (a: Keyed<{ battleId: string }>) =>
      rpc<T.BattleState_>("forfeit_battle_v1", { p_battle_id: a.battleId, p_request_key: a.requestKey }),
    getMyBattles: (a: { before?: string | null; limit?: number } = {}) =>
      rpc<T.BattleHistoryPage>("get_my_battles_v1", { p_before: a.before ?? null, p_limit: a.limit ?? 20 }),
    getLeaderboard: (a: { scope: LeaderboardScope; facultyId?: string | null; cursor?: string | null; limit?: number }) =>
      rpc<T.LeaderboardPage>("get_leaderboard_v1", {
        p_scope: a.scope,
        p_faculty_id: a.facultyId ?? null,
        p_cursor: a.cursor ?? null,
        p_limit: a.limit ?? 20,
      }),

    /* ----------------------------------------- Config ----------------------------------------- */
    getAppConfig: (platform: "web" | "ios" | "android" = "web") =>
      select<T.AppConfigRow | null>(
        supabase
          .from("app_config")
          .select("platform, minimum_build, minimum_api_version, maintenance, message, feature_flags")
          .eq("platform", platform)
          .maybeSingle(),
      ),

    /* ----------------------------------------- Admin ------------------------------------------ */
    admin: {
      publish: (a: Keyed<{ entityType: AdminEntityType; id: string }>) =>
        rpc<T.PublishResult>("admin_publish_v1", { p_entity_type: a.entityType, p_id: a.id, p_request_key: a.requestKey }),
      retire: (a: Keyed<{ entityType: Exclude<AdminEntityType, "battle_rules">; id: string; reason: string }>) =>
        rpc<T.RetireResult>("admin_retire_v1", {
          p_entity_type: a.entityType,
          p_id: a.id,
          p_reason: a.reason,
          p_request_key: a.requestKey,
        }),
      getQuestion: (questionVersionId: string) =>
        rpc<T.AdminQuestion>("admin_get_question_v1", { p_question_version_id: questionVersionId }),
      importQuestions: (a: { rows: Record<string, unknown>[]; dryRun: boolean; requestKey?: string }) =>
        rpc<T.ImportResult>("admin_import_questions_v1", {
          p_rows: a.rows,
          p_dry_run: a.dryRun,
          p_request_key: a.requestKey ?? null,
        }),
      importLessons: (a: { rows: Record<string, unknown>[]; dryRun: boolean; requestKey?: string }) =>
        rpc<T.ImportResult>("admin_import_lessons_v1", {
          p_rows: a.rows,
          p_dry_run: a.dryRun,
          p_request_key: a.requestKey ?? null,
        }),
      upsertAssessmentDraft: (
        a: Keyed<{
          assessmentId?: string | null;
          courseId: string;
          kind: "review" | "practice" | "mock";
          title: string;
          lessonId?: string | null;
          questionCount: number;
          durationSeconds?: number | null;
          questionVersionIds: string[];
        }>,
      ) =>
        rpc<T.Envelope & { assessment_id: string; assessment_version_id: string; version: number; status: "draft" }>(
          "admin_upsert_assessment_draft_v1",
          {
            p_assessment_id: a.assessmentId ?? null,
            p_course_id: a.courseId,
            p_kind: a.kind,
            p_title: a.title,
            p_lesson_id: a.lessonId ?? null,
            p_question_count: a.questionCount,
            p_duration_seconds: a.durationSeconds ?? null,
            p_question_version_ids: a.questionVersionIds,
            p_request_key: a.requestKey,
          },
        ),
      correctResult: (a: Keyed<{ resultType: "attempt" | "battle"; resultId: string; reason: string }>) =>
        rpc<T.CorrectResultResult>("admin_correct_result_v1", {
          p_result_type: a.resultType,
          p_result_id: a.resultId,
          p_reason: a.reason,
          p_request_key: a.requestKey,
        }),
      correctAcademicProfile: (
        a: Keyed<{
          userId: string;
          universityId: string;
          facultyId: string;
          departmentId: string;
          levelId: string;
          academicPeriodId: string;
          semesterId: string;
          reason: string;
        }>,
      ) =>
        rpc<T.Envelope & { user_id: string; academic: T.Profile["academic"] }>("admin_correct_academic_profile_v1", {
          p_user_id: a.userId,
          p_university_id: a.universityId,
          p_faculty_id: a.facultyId,
          p_department_id: a.departmentId,
          p_level_id: a.levelId,
          p_academic_period_id: a.academicPeriodId,
          p_semester_id: a.semesterId,
          p_reason: a.reason,
          p_request_key: a.requestKey,
        }),
      setRole: (a: Keyed<{ userId: string; role: "student" | "admin"; granted: boolean; reason: string }>) =>
        rpc<T.Envelope & { user_id: string; roles: string[] }>("admin_set_role_v1", {
          p_user_id: a.userId,
          p_role: a.role,
          p_granted: a.granted,
          p_reason: a.reason,
          p_request_key: a.requestKey,
        }),
      grantPremium: (a: Keyed<{ userId: string; endsAt: string; reason: string }>) =>
        rpc<T.PremiumGrantResult>("admin_grant_premium_v1", {
          p_user_id: a.userId,
          p_ends_at: a.endsAt,
          p_reason: a.reason,
          p_request_key: a.requestKey,
        }),
      revokePremium: (a: Keyed<{ entitlementId: string; reason: string }>) =>
        rpc<T.PremiumRevokeResult>("admin_revoke_premium_v1", {
          p_entitlement_id: a.entitlementId,
          p_reason: a.reason,
          p_request_key: a.requestKey,
        }),
      triageReport: (a: Keyed<{ reportId: string; state: "triaged" | "resolved" | "dismissed"; resolution?: string }>) =>
        rpc<T.TriageResult>("admin_triage_report_v1", {
          p_report_id: a.reportId,
          p_state: a.state,
          p_resolution: a.resolution ?? null,
          p_request_key: a.requestKey,
        }),
      listAudit: (a: { entityType?: string | null; before?: string | null; limit?: number } = {}) =>
        rpc<T.AuditPage>("admin_list_audit_v1", {
          p_entity_type: a.entityType ?? null,
          p_before: a.before ?? null,
          p_limit: a.limit ?? 50,
        }),

      /* Admin-only direct reads (RLS grants rows to admins only). */
      listReports: (state?: string | null) => {
        let q = supabase
          .from("content_reports")
          .select("id, user_id, target_type, target_id, category, note, state, resolution, created_at, resolved_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (state) q = q.eq("state", state);
        return select<T.AdminReportRow[]>(q);
      },
      listOfferings: async () => {
        const rows: T.AdminOfferingRow[] = [];
        const pageSize = 200;
        for (let offset = 0; ; offset += pageSize) {
          const page = await select<T.AdminOfferingRow[]>(
            supabase.from("course_offerings").select(
              "id, status, created_at, course:courses(id, code, title), department:departments(id, name, faculty:faculties(id, name, university:universities(id, name))), level:levels(id, label), semester:semesters(id, label, period:academic_periods(id, label))",
            ).order("created_at", { ascending: false }).order("id", { ascending: true }).range(offset, offset + pageSize - 1),
          );
          rows.push(...page);
          if (page.length < pageSize) return rows;
        }
      },
      listLessonVersions: (status?: string | null) => {
        let q = supabase
          .from("lesson_versions")
          .select(
            "id, lesson_id, version, title, objective, blocks, flashcards, estimated_minutes, status, source_reference, reviewed_by, published_at, created_at, lesson:lessons(course_id)",
          )
          .order("created_at", { ascending: false })
          .limit(100);
        if (status) q = q.eq("status", status);
        return select<T.AdminLessonVersionRow[]>(q);
      },
      getIngestionEvidence: (sourceReference: string) =>
        rpc<{ items: T.IngestionEvidenceItem[] }>("admin_get_ingestion_evidence_v1", { p_source_reference: sourceReference }),
      listQuestionVersions: (status?: string | null) => {
        let q = supabase
          .from("question_versions")
          .select("id, question_id, version, prompt, difficulty, usage, status, source_reference, created_at, question:questions(course_id, pool, logical_key)")
          .order("created_at", { ascending: false })
          .limit(100);
        if (status) q = q.eq("status", status);
        return select<T.AdminQuestionVersionRow[]>(q);
      },
      listAssessmentVersions: (status?: string | null) => {
        let q = supabase
          .from("assessment_versions")
          .select("id, assessment_id, version, question_count, duration_seconds, status, created_at, assessment:assessments(title, kind, course_id)")
          .order("created_at", { ascending: false })
          .limit(100);
        if (status) q = q.eq("status", status);
        return select<T.AdminAssessmentVersionRow[]>(q);
      },
      listBattles: (state?: string | null) => {
        let q = supabase
          .from("battles")
          .select("id, mode, state, result_kind, cancel_reason, created_at, finalized_at, offering_id")
          .order("created_at", { ascending: false })
          .limit(100);
        if (state) q = q.eq("state", state);
        return select<T.AdminBattleRow[]>(q);
      },
      listEntitlements: () =>
        select<T.AdminEntitlementRow[]>(
          supabase
            .from("entitlements")
            .select("id, user_id, feature, source, starts_at, ends_at, revoked_at, reason, created_at")
            .order("created_at", { ascending: false })
            .limit(100),
        ),
      countContent: async () => {
        const count = async (table: string, status?: string) => {
          let q = supabase.from(table).select("id", { count: "exact", head: true });
          if (status) q = q.eq("status", status);
          const res = await q;
          if (res.error) throw parseRpcError(res.error, res.status);
          return res.count ?? 0;
        };
        const [lessonsDraft, lessonsPublished, questionsDraft, questionsPublished, offeringsPublished, reportsOpen] =
          await Promise.all([
            count("lesson_versions", "draft"),
            count("lesson_versions", "published"),
            count("question_versions", "draft"),
            count("question_versions", "published"),
            count("course_offerings", "published"),
            (async () => {
              const res = await supabase.from("content_reports").select("id", { count: "exact", head: true }).eq("state", "open");
              if (res.error) throw parseRpcError(res.error, res.status);
              return res.count ?? 0;
            })(),
          ]);
        return { lessonsDraft, lessonsPublished, questionsDraft, questionsPublished, offeringsPublished, reportsOpen };
      },
    },
  };
}

export type ScholauApi = ReturnType<typeof createScholauApi>;

export { ScholauApiError };
