/**
 * Analytics adapter (TRD §6). Events carry a stable opaque user id and minimal properties only:
 * never answer text, emails, names or other PII. Session replay is disabled.
 */
export type AnalyticsEvent =
  | { name: "signup_completed" }
  | { name: "onboarding_completed" }
  | { name: "lesson_started"; lesson_id: string }
  | { name: "lesson_completed"; lesson_id: string; xp_awarded: number }
  | { name: "attempt_started"; assessment_kind: string; attempt_id: string }
  | { name: "attempt_completed"; assessment_kind: string; attempt_id: string; status: string }
  | { name: "battle_queued"; mode: "queue" | "direct" }
  | { name: "battle_activated"; battle_id: string }
  | { name: "battle_completed"; battle_id: string; outcome: string }
  | { name: "content_reported"; target_type: string; category: string };

export type AnalyticsEventName = AnalyticsEvent["name"];

export interface AnalyticsAdapter {
  identify(opaqueUserId: string | null): void;
  track(event: AnalyticsEvent): void;
}

export const noopAnalytics: AnalyticsAdapter = {
  identify() {},
  track() {},
};
