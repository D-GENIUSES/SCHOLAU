export type ChallengeState = "draft" | "upcoming" | "active" | "finished" | "cancelled";
export interface CourseChallenge {
  id: string; offering_id: string; title: string; instructions: string; duration_minutes: number;
  state: ChallengeState; starts_at: string | null; ends_at: string | null; revision: number; question_count: number;
}
export interface ChallengeQuestion {
  source_version_id?: string | null; prompt: string; options: string[]; correct?: number; explanation?: string;
}
export interface ChallengeDraft { starts_at?: string | null; title: string; instructions: string; duration_minutes: number; questions: ChallengeQuestion[] }
export interface ChallengeAttempt { answers: Record<string, number>; revision: number; submitted_at: string | null; score: number | null }
export interface ChallengeDetail { challenge: CourseChallenge; teacher: boolean; questions: ChallengeQuestion[]; attempt: ChallengeAttempt | null; server_time: string }
export interface ChallengeRosterRow {
  user_id: string | null; name: string; is_me: boolean; status: "not_participated" | "participating" | "submitted";
  score: number | null; elapsed_seconds: number | null; rank: number | null;
}
export interface ChallengeRoster { items: ChallengeRosterRow[]; total: number; finished: boolean }
export interface ChallengeList { items: CourseChallenge[]; teacher: boolean; course: { code: string; title: string; semester: string; period: string }; server_time: string }
