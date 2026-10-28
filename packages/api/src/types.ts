/**

 * Response/argument types for the ScholAu RPC contract, written from the SQL in

 * supabase/migrations/*_rpc_*.sql. Replace with generated `supabase/types/database.ts` when available.

 */

import type {

  ActivityKind,

  AssessmentKind,

  AttemptStatus,

  BattleCancelReason,

  BattleMode,

  BattleOutcome,

  BattleResultKind,

  BattleState,

  ContentStatus,

  Difficulty,

  FeedbackMode,

  IsoDate,

  IsoDateTime,

  LeaderboardScope,

  LessonBlock,

  LessonState,

  QueueState,

  ReportCategory,

  ReportState,

  ReportTargetType,

  Role,

  Uuid,

} from "@scholau/core";



export interface Envelope {

  server_time: IsoDateTime;

  request_id?: Uuid;

}



export interface Named {

  id: Uuid;

  name: string;

}

export interface Labelled {

  id: Uuid;

  label: string;

}



export interface Streak {

  current: number;

  longest: number;

  active_today: boolean;

  local_date: IsoDate;

}



export interface Profile extends Envelope {
  username: string;
  id: Uuid;

  display_name: string;

  avatar_path: string | null;

  leaderboard_visible: boolean;

  needs_onboarding: boolean;

  academic: {

    university: Named;

    faculty: Named;

    department: Named;

    level: Labelled;

    academic_period: Labelled;

    semester: Labelled;

    changed_at: IsoDateTime | null;

    self_change_used_this_period: boolean;

  } | null;

  roles: Role[];

  premium: boolean;

  xp_total: number;

  streak: Streak;

  learning_totals: { lessons_completed: number; assessments_completed: number; battles_completed: number };

  created_at: IsoDateTime;

}



export interface OnboardingOptions extends Envelope {

  universities: (Named & { slug: string })[];

  faculties: Named[];

  departments: Named[];

  levels: Labelled[];

  academic_periods: (Labelled & { starts_on: IsoDate; ends_on: IsoDate })[];

  semesters: Labelled[];

}



export interface CourseRef {

  id: Uuid;

  code: string;

  title: string;

  description?: string | null;

}



export interface CatalogOffering {

  elective_selection_count?: number | null;

  unit_count?: number | null;

  requirement_status?: "C" | "R" | "E" | null;

  lecture_hours?: number | null;

  practical_hours?: number | null;

  elective_group?: string | null;

  offering_id: Uuid;

  course: CourseRef;

  enrolled: boolean;

  lesson_count: number;

  lessons_completed: number;

}



export interface Catalog extends Envelope {

  needs_onboarding: boolean;

  offerings: CatalogOffering[];

}



export interface Enrollment extends Envelope {

  offering_id: Uuid;

  enrolled_at: IsoDateTime;

  active: boolean;

}



export interface CourseLesson {

  lesson_id: Uuid;

  lesson_version_id: Uuid;

  position: number;

  title: string;

  objective: string;

  estimated_minutes: number;

  state: LessonState;

  completed_at: IsoDateTime | null;

}



export interface CourseModule {

  id: Uuid;

  title: string;

  position: number;

  lessons: CourseLesson[];

}



export interface CourseAssessment {

  assessment_id: Uuid;

  assessment_version_id: Uuid;

  kind: AssessmentKind;

  title: string;

  lesson_id: Uuid | null;

  question_count: number;

  duration_seconds: number | null;

  feedback_mode: FeedbackMode;

  active_attempt_id: Uuid | null;

  completed_attempts: number;

  best_percent: number | null;

  first_completion_rewarded: boolean;

}



export interface CourseOverview extends Envelope {

  unit_count?: number | null;

  requirement_status?: "C" | "R" | "E" | null;

  lecture_hours?: number | null;

  practical_hours?: number | null;

  elective_group?: string | null;

  offering_id: Uuid;

  course: CourseRef;

  progress: { lessons_total: number; lessons_completed: number; percent: number };

  modules: CourseModule[];

  assessments: CourseAssessment[];

  battle_ready: boolean;

}



export interface Lesson extends Envelope {

  lesson_id: Uuid;

  lesson_version_id: Uuid;

  version: number;

  offering_id: Uuid;

  course_id: Uuid;

  module: { id: Uuid; title: string; position: number } | null;

  position: number;

  title: string;

  objective: string;

  estimated_minutes: number;

  blocks: LessonBlock[];

  flashcards?: { front: string; back: string; tag?: string }[];

  previous_lesson_id: Uuid | null;

  next_lesson_id: Uuid | null;

  progress: { state: Exclude<LessonState, "not_started">; started_at: IsoDateTime; completed_at: IsoDateTime | null } | null;

  review: { assessment_id: Uuid; assessment_version_id: Uuid; title: string } | null;

}



export interface LessonProgressResult extends Envelope {

  lesson_id: Uuid;

  state: Exclude<LessonState, "not_started">;

  started_at?: IsoDateTime;

  completed_at: IsoDateTime | null;

}



export interface CompleteLessonResult extends LessonProgressResult {

  already_completed: boolean;

  /** True only for the first successful lesson completion, determined on the server. */

  first_lesson_completed?: boolean;

  /** True when this completion is the learner's first activity today. */
  streak_advanced?: boolean;

  xp_awarded: number;

  xp_capped: boolean;

  xp_total: number | null;

  streak: Streak;

}



export interface AttemptOption {

  id: Uuid;

  body: string;

}



export interface AttemptQuestion {

  position: number;

  question_version_id: Uuid;

  prompt: string;

  difficulty: Difficulty;

  options: AttemptOption[];

  saved: { option_id: Uuid; answer_revision: number; locked: boolean } | null;

  feedback: { is_correct: boolean; correct_option_id: Uuid; explanation: string } | null;

}



export interface AttemptResultSummary {

  correct_count: number | null;

  answered_count: number | null;

  total_count: number;

  percent: number;

  xp_awarded: number;

  xp_capped: boolean;

  voided_reason: string | null;

}



export interface Attempt extends Envelope {

  lesson_id?: Uuid | null;

  xp_review_stage?: number | null;

  attempt_id: Uuid;

  assessment_id: Uuid;

  assessment_version_id: Uuid;

  offering_id: Uuid;

  kind: AssessmentKind;

  title: string;

  status: AttemptStatus;

  feedback_mode: FeedbackMode;

  started_at: IsoDateTime;

  expires_at: IsoDateTime | null;

  finalized_at: IsoDateTime | null;

  revision: number;

  total_count: number;

  questions: AttemptQuestion[];

  result: AttemptResultSummary | null;

  resumed?: boolean;

  deadline_passed?: boolean;

}



export interface AnswerInput {

  question_version_id: Uuid;

  option_id: Uuid;

  answer_revision: number;

}



export interface SaveAnswersResult extends Envelope {

  attempt_id: Uuid;

  revision: number;

  expires_at: IsoDateTime | null;

  saved: { question_version_id: Uuid; answer_revision: number }[];

}



export interface ReviewCheckResult extends Envelope {

  attempt_id: Uuid;

  question_version_id: Uuid;

  option_id: Uuid;

  locked: true;

  is_correct: boolean;

  correct_option_id: Uuid;

  explanation: string;

}



export interface ContinueLearning {

  kind: "resume" | "next";

  lesson_id: Uuid;

  lesson_version_id: Uuid;

  title: string;

  estimated_minutes: number;

  course_id: Uuid;

  course_title: string;

  offering_id: Uuid;

}



export interface HomeSummary extends Envelope {

  welcome_xp_awarded?: boolean;

  display_name: string;

  needs_onboarding: boolean;

  xp_total: number;

  learning_xp_today: number;

  learning_xp_daily_cap: number | null;

  streak: Streak;

  premium: boolean;

  continue_learning: ContinueLearning | null;

  enrolled_courses: {

    offering_id: Uuid;

    course_id: Uuid;

    code: string;

    title: string;

    lessons_total: number;

    lessons_completed: number;

  }[];

  recent_activity: { kind: ActivityKind; source_id: Uuid; local_date: IsoDate; created_at: IsoDateTime; xp: number }[];

  live_battle: { battle_id: Uuid | null; queue_id: Uuid | null; expires_at: IsoDateTime } | null;

  unread_notifications: number;

}



export interface ReportReceipt extends Envelope {

  report_id: Uuid;

  state: ReportState;

  created_at: IsoDateTime;

}



export interface NotificationReadResult extends Envelope {

  updated: number;

  unread: number;

}

export interface NotificationClearResult extends Envelope {
  deleted: number;
}

export interface Notification {

  id: Uuid;

  kind: string;

  body: string;

  safe_target: string | null;

  read_at: IsoDateTime | null;

  created_at: IsoDateTime;
  expires_at: IsoDateTime;
}



/* ----------------------------------------------------------------------------------------------- */

/* Battles                                                                                          */

/* ----------------------------------------------------------------------------------------------- */



export interface BattleParticipant {
  user_id?: string;
  seat: 1 | 2;

  display_name: string;

  avatar_path: string | null;

  is_me: boolean;

  ready: boolean;

  forfeited: boolean;

  correct_count: number | null;

}



export interface BattleCurrentQuestion {
  answer_format?: "standard" | "worked_solution" | "fill_in_gap";
  duration_seconds?: number;
  reading_at?: string;
  course_code?: string;
  position: number;
  prompt: string;
  options: (AttemptOption & { steps?: string[] })[];
  opened_at: IsoDateTime;
  deadline: IsoDateTime;
  my_option_id: Uuid | null;
  my_text_answer?: string | null;
}

export interface BattleCorrection extends Envelope {
  position: number;
  answer_format: "standard" | "worked_solution" | "fill_in_gap";
  my_answer: string | null;
  correct_answer: string | null;
  steps: string[];
  explanation: string | null;
}

export interface BattleRound {
  my_text_answer?: string | null;
  course_code?: string;
  position: number;
  prompt: string;
  my_option_id: Uuid | null;
  my_is_correct: boolean;
  opponent_is_correct: boolean;
}

export interface Battle {

  courses?: { id: string; code: string; title: string }[];

  invited_user_id?: string | null;

  battle_id: Uuid;

  mode: BattleMode;

  state: BattleState;

  revision: number;

  offering_id: Uuid;

  course: { id: Uuid; code: string; title: string } | null;

  round_count: number;

  seconds_per_round: number;

  invitation_expires_at: IsoDateTime | null;

  ready_deadline: IsoDateTime | null;

  starts_at: IsoDateTime | null;

  ends_at: IsoDateTime | null;

  finalized_at: IsoDateTime | null;

  result_kind: BattleResultKind | null;

  cancel_reason: BattleCancelReason | null;

  invite_token: string | null;

  me: { seat: 1 | 2; ready: boolean; forfeited: boolean } | null;

  participants: BattleParticipant[];

  current_question: BattleCurrentQuestion | null;

  next_question_at: IsoDateTime | null;

  my_answered_positions: number[];

  rounds: BattleRound[] | null;

  outcome: { result: "win" | "draw" | "loss" | "cancelled"; xp_awarded: number } | null;

}



export type BattleState_ = Battle & Envelope;



export interface QueueEntry {

  queue_id: Uuid;

  offering_id: Uuid;

  state: QueueState;

  queued_at: IsoDateTime;

  expires_at: IsoDateTime;

  battle_id?: Uuid | null;

}



export type JoinQueueResult = QueueEntry & Envelope;



export interface LeaveQueueResult extends Envelope {

  queue_id: Uuid | null;

  state: QueueState | null;

  battle_id: Uuid | null;

}



export interface LiveBattle extends Envelope {

  queue: QueueEntry | null;

  battle: Battle | null;

}



export interface BattleAnswerAck extends Envelope {

  battle_id: Uuid;

  position: number;

  accepted: boolean;

  already_answered?: boolean;

  option_id: Uuid | null;

  text_answer?: string | null;

  received_at: IsoDateTime;

}



export interface BattleHistoryItem {
  courses?: { code: string; title: string }[];
  battle_id: Uuid;

  mode: BattleMode;

  state: BattleState;

  result_kind: BattleResultKind | null;

  cancel_reason: BattleCancelReason | null;

  course: { code: string; title: string };

  opponent: { display_name: string; avatar_path: string | null } | null;

  my_correct: number | null;

  opponent_correct: number | null;

  outcome: BattleOutcome;

  xp_awarded: number;

  round_count: number;

  created_at: IsoDateTime;

  finalized_at: IsoDateTime | null;

  joined_at: IsoDateTime;

}



export interface BattleHistoryPage extends Envelope {

  items: BattleHistoryItem[];

  next_before: IsoDateTime | null;

}



export interface LeaderboardRow {

  rank: number;

  user_id: Uuid;

  display_name: string;

  avatar_path: string | null;

  xp_total: number;

  is_me: boolean;
  faculty_name?: string | null;
  level_label?: string | null;
}



export interface LeaderboardPage extends Envelope {

  scope: LeaderboardScope;

  faculty_id: Uuid | null;

  as_of: IsoDateTime;

  rows: LeaderboardRow[];

  me: { rank: number; xp_total: number } | null;

  next_cursor: string | null;

}



/* ----------------------------------------------------------------------------------------------- */

/* Admin                                                                                            */

/* ----------------------------------------------------------------------------------------------- */



export interface ImportRowError {

  row: number;

  field: string;

  message: string;

}



export interface ImportResult extends Envelope {

  dry_run: boolean;

  valid: boolean;

  row_count: number;

  error_count: number;

  errors: ImportRowError[];

  imported: boolean;

  created: Record<string, unknown>[];

}



export interface PublishResult extends Envelope {

  entity_type: string;

  id: Uuid;

  status?: ContentStatus;

  already_published?: boolean;

  [key: string]: unknown;

}



export interface RetireResult extends Envelope {

  entity_type: string;

  id: Uuid;

  retired: boolean;

}



export interface AdminQuestion extends Envelope {
  answer_format: "standard" | "worked_solution" | "fill_in_gap";
  battle_seconds: number | null;
  battle_reading_seconds?: number | null;
  suggested_answer_seconds?: number;
  suggested_reading_seconds?: number;
  question_id: Uuid;

  course_id: Uuid;

  lesson_id: Uuid | null;

  pool: "learning" | "battle";

  logical_key: string;

  question_version_id: Uuid;

  version: number;

  status: ContentStatus;

  prompt: string;

  difficulty: Difficulty;

  usage: string[];

  source_reference: string | null;

  reviewed_by: Uuid | null;

  published_at: IsoDateTime | null;

  options: { id: Uuid; label: string; body: string; position: number; steps?: string[] }[];

  correct_option_id: Uuid | null;

  gap_answers?: { index?: number; accepted_answers: string[] }[] | null;

  explanation: string | null;

}

export interface MaterialIngestionJobStatus {
  id: string;
  status: string;
  filename?: string;
  sha256?: string;
  stats?: Record<string, unknown>;
  error?: string | null;
  duplicate_file?: boolean;
  job_id?: string;
  message?: string;
}

export interface IngestionEvidenceItem {
  content_fingerprint: string;
  logical_key: string | null;
  source_text: string | null;
  created_at: string;
  job_id: string;
}



export interface CorrectResultResult extends Envelope {

  result_type: "attempt" | "battle";

  result_id: Uuid;

  state: "voided";

  compensations: { user_id: Uuid; amount: number; adjusts_entry_id: Uuid }[];

}



export interface PremiumGrantResult extends Envelope {

  entitlement_id: Uuid;

  user_id: Uuid;

  starts_at: IsoDateTime;

  ends_at: IsoDateTime | null;

  premium: boolean;

}



export interface PremiumRevokeResult extends Envelope {

  entitlement_id: Uuid;

  revoked_at: IsoDateTime;

  premium: boolean;

}



export interface TriageResult extends Envelope {

  report_id: Uuid;

  state: ReportState;

  resolved_at: IsoDateTime | null;

}



export interface AuditItem {

  id: Uuid;

  actor_id: Uuid | null;

  action: string;

  entity_type: string;

  entity_id: Uuid | null;

  reason: string | null;

  safe_metadata: Record<string, unknown>;

  created_at: IsoDateTime;

}



export interface AuditPage extends Envelope {

  items: AuditItem[];

}



/* Direct table rows readable by admins via RLS. */

export interface AdminReportRow {

  id: Uuid;

  user_id: Uuid;

  target_type: ReportTargetType;

  target_id: Uuid | null;

  category: ReportCategory;

  note: string;

  state: ReportState;

  resolution: string | null;

  created_at: IsoDateTime;

  resolved_at: IsoDateTime | null;

}



export interface AdminOfferingRow {

  id: Uuid;

  status: ContentStatus;

  created_at: IsoDateTime;

  course: { id: Uuid; code: string; title: string } | null;

  department: {

    id: Uuid;

    name: string;

    faculty: { id: Uuid; name: string; university: { id: Uuid; name: string } | null } | null;

  } | null;

  level: { id: Uuid; label: string } | null;

  semester: { id: Uuid; label: string; period: { id: Uuid; label: string } | null } | null;

}



export interface AdminLessonVersionRow {

  id: Uuid;

  lesson_id: Uuid;

  version: number;

  title: string;

  objective: string;

  blocks: LessonBlock[];

  flashcards?: { front: string; back: string; tag?: string }[];

  estimated_minutes: number;

  status: ContentStatus;

  source_reference: string | null;

  reviewed_by: Uuid | null;

  published_at: IsoDateTime | null;

  created_at: IsoDateTime;

  lesson?: { course_id: Uuid };

}



export interface AdminQuestionVersionRow {

  id: Uuid;

  question_id: Uuid;

  version: number;

  prompt: string;

  difficulty: Difficulty;

  usage: string[];

  status: ContentStatus;

  source_reference: string | null;

  created_at: IsoDateTime;

  question: { course_id: Uuid; pool: "learning" | "battle"; logical_key: string } | null;

}



export interface AdminAssessmentVersionRow {

  id: Uuid;

  assessment_id: Uuid;

  version: number;

  question_count: number;

  duration_seconds: number | null;

  status: ContentStatus;

  created_at: IsoDateTime;

  assessment: { title: string; kind: AssessmentKind; course_id: Uuid } | null;

}



export interface AdminBattleRow {

  id: Uuid;

  mode: BattleMode;

  state: BattleState;

  result_kind: BattleResultKind | null;

  cancel_reason: BattleCancelReason | null;

  created_at: IsoDateTime;

  finalized_at: IsoDateTime | null;

  offering_id: Uuid;

}



export interface AdminEntitlementRow {

  id: Uuid;

  user_id: Uuid;

  feature: "premium";

  source: string;

  starts_at: IsoDateTime;

  ends_at: IsoDateTime | null;

  revoked_at: IsoDateTime | null;

  reason: string | null;

  created_at: IsoDateTime;

}



export interface AppConfigRow {

  platform: "web" | "ios" | "android";

  minimum_build: number;

  minimum_api_version: number;

  maintenance: boolean;

  message: string | null;

  feature_flags: Record<string, unknown>;

}



export interface XpProgress extends Envelope {

  xp_total: number;

  progress: { level: number; current_level_xp: number; next_level_xp: number; xp_into_level: number; xp_to_advance: number };

  badges: { code: string; awarded_at: string }[];

  history: { id: string; activity: string; amount: number; reason: string; date: string }[];

  reviews: { lesson_id: string; title: string; stage: number; due_at: string; completed: boolean; available: boolean }[];

}



export type FriendAction = "request" | "accept" | "decline" | "cancel" | "remove" | "block" | "unblock";
export interface PublicProfile extends Envelope {
  id: string; display_name: string; username: string | null; avatar_path: string | null;
  joined_at: string; university: string | null; faculty: string | null;
  department: string | null; level: string | null; xp_total: number | null; badges: string[];
}

export interface FriendPerson {
  avatar_path?: string | null;
  user_id: string; display_name: string; username: string | null;

  state: "pending" | "accepted" | "blocked" | null; incoming: boolean;

}

export interface FriendsState extends Envelope { username: string; people: FriendPerson[] }

export interface BattleSetup extends Envelope {

  courses: { offering_id: string; course_id: string; code: string; title: string; available_questions: number }[];

}

export interface BattleInvitations extends Envelope {

  invitations: { battle_id: string; invite_token: string; display_name: string; round_count: number; expires_at: string; courses: string[] }[];

}





export interface NotificationPreferences {

  activity: boolean; academic: boolean; announcement: boolean; account: boolean; reminder: boolean;

  timezone: string; reminder_time: string; quiet_start: string; quiet_end: string;

}

export interface NotificationSettingsResult extends Envelope {

  preferences: NotificationPreferences & { updated_at: string | null };

  push_available: boolean; vapid_public_key: string;

  devices: Array<{ device_key: string; active: boolean }>;

}

export interface AnnouncementAudienceResult extends Envelope {

  offerings: Array<{ id: string; label: string }>;

}

export interface AnnouncementInput {

  title: string; body: string; target: string | null;

  audience: "offering" | "role" | "everyone"; audienceId: string | null; requestKey: string;

}

export interface AnnouncementReceipt extends Envelope { announcement_id: string; recipient_count: number }

export interface PushHealth extends Envelope {

  delivery_enabled: boolean; states: Record<string, number>; pending_recipients: number;

  oldest_pending_at: string | null;

  failures: Array<{ id: string; last_code: string | null; attempts: number; updated_at: string }>;

}


export interface NotificationPreferences {
  activity: boolean; academic: boolean; announcement: boolean; account: boolean; reminder: boolean;
  timezone: string; reminder_time: string; quiet_start: string; quiet_end: string;
}
export interface NotificationSettingsResult extends Envelope {
  preferences: NotificationPreferences & { updated_at: string | null };
  push_available: boolean; vapid_public_key: string;
  devices: Array<{ device_key: string; active: boolean }>;
}
export interface AnnouncementAudienceResult extends Envelope {
  offerings: Array<{ id: string; label: string }>;
}
export interface AnnouncementInput {
  title: string; body: string; target: string | null;
  audience: "offering" | "role" | "everyone"; audienceId: string | null; requestKey: string;
}
export interface AnnouncementReceipt extends Envelope { announcement_id: string; recipient_count: number }
export interface PushHealth extends Envelope {
  delivery_enabled: boolean; states: Record<string, number>; pending_recipients: number;
  oldest_pending_at: string | null;
  failures: Array<{ id: string; last_code: string | null; attempts: number; updated_at: string }>;
}
