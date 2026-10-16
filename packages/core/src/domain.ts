/** Domain vocabulary shared by web and native. The database is authoritative for every rule. */

export type Uuid = string;
export type IsoDateTime = string;
export type IsoDate = string;

export type Role = "student" | "admin" | "lecturer";

export type AssessmentKind = "review" | "practice" | "mock";
export type FeedbackMode = "immediate" | "after_submit";
export type AttemptStatus = "active" | "submitted" | "expired" | "voided";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type LessonState = "not_started" | "started" | "completed";
export type ContentStatus = "draft" | "published" | "retired";

export type BattleMode = "direct" | "queue";
export type BattleState = "waiting" | "ready" | "countdown" | "active" | "finished" | "cancelled" | "voided";
export type BattleResultKind = "win" | "draw" | "forfeit" | "double_forfeit" | "cancelled" | "voided";
export type BattleCancelReason =
  | "invite_expired"
  | "ready_timeout"
  | "pre_start_cancel"
  | "early_forfeit"
  | "content_unavailable"
  | "admin_void";
export type BattleOutcome = "win" | "draw" | "loss" | "cancelled" | "voided" | "in_progress";
export type QueueState = "waiting" | "matched" | "cancelled" | "expired";

export type LeaderboardScope = "faculty" | "global";

export type ReportTargetType = "lesson" | "question" | "battle" | "technical";
export type ReportCategory = "incorrect" | "unclear" | "typo" | "offensive" | "broken" | "other";
export type ReportState = "open" | "triaged" | "resolved" | "dismissed";

export type ActivityKind = "lesson_completed" | "assessment_completed" | "battle_completed";

export type AdminEntityType =
  | "lesson_version"
  | "question_version"
  | "assessment_version"
  | "course_offering"
  | "battle_rules";

/** Structured lesson blocks (server-validated; rendered only from these allowed types). */
export type LessonBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level?: 2 | 3 | 4 }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "image"; path: string; alt: string; caption?: string }
  | { type: "callout"; text: string; tone?: "info" | "tip" | "warning" | "example"; title?: string }
  | { type: "code"; code: string; language?: string };

export const LIVE_BATTLE_STATES: readonly BattleState[] = ["waiting", "ready", "countdown", "active"];
export const TERMINAL_BATTLE_STATES: readonly BattleState[] = ["finished", "cancelled", "voided"];

export function isLiveBattleState(state: BattleState): boolean {
  return LIVE_BATTLE_STATES.includes(state);
}

export const REPORT_CATEGORIES: readonly { value: ReportCategory; label: string }[] = [
  { value: "incorrect", label: "Incorrect information" },
  { value: "unclear", label: "Unclear or confusing" },
  { value: "typo", label: "Typo or formatting" },
  { value: "broken", label: "Something is broken" },
  { value: "offensive", label: "Offensive or inappropriate" },
  { value: "other", label: "Other" },
];

export const ASSESSMENT_KIND_LABEL: Record<AssessmentKind, string> = {
  review: "Review",
  practice: "Practice",
  mock: "Mock exam",
};
