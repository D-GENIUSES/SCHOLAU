import { parseRpcError, type AnySupabaseClient } from "@scholau/api";
import type { ChallengeDetail, ChallengeDraft, ChallengeList, ChallengeQuestion, ChallengeRoster, CourseChallenge } from "@scholau/core";
export function challengeApi(client: AnySupabaseClient) {
  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error, status } = await client.rpc(name, args);
    if (error) throw parseRpcError(error, status);
    return data as T;
  }
  return {
    list: (offering: string, offset = 0) => rpc<ChallengeList>("list_course_challenges_v1", { p_offering_id: offering, p_offset: offset }),
    bank: (offering: string, search = "", offset = 0) => rpc<{ items: ChallengeQuestion[] }>("challenge_question_bank_v1", { p_offering_id: offering, p_search: search, p_offset: offset }),
    save: (id: string, offering: string, revision: number, data: ChallengeDraft) => rpc<{ challenge: CourseChallenge; questions: ChallengeQuestion[] }>("save_course_challenge_v1", { p_id: id, p_offering_id: offering, p_revision: revision, p_data: data }),
    publish: (id: string, revision: number, startsAt: string | null) => rpc<{ challenge: CourseChallenge }>("publish_course_challenge_v1", { p_id: id, p_revision: revision, p_starts_at: startsAt }),
    cancel: (id: string) => rpc<{ cancelled: boolean }>("cancel_course_challenge_v1", { p_id: id }),
    detail: (id: string, userId: string | null = null) => rpc<ChallengeDetail>("get_course_challenge_v1", { p_id: id, p_user_id: userId }),
    join: (id: string) => rpc<ChallengeDetail>("join_course_challenge_v1", { p_id: id }),
    answer: (id: string, question: number, option: number, revision: number) => rpc<ChallengeDetail>("answer_course_challenge_v1", { p_id: id, p_question: question, p_option: option, p_revision: revision }),
    submit: (id: string, revision: number) => rpc<ChallengeDetail>("submit_course_challenge_v1", { p_id: id, p_revision: revision }),
    roster: (offering: string, challenge: string | null = null, search = "", offset = 0) => rpc<ChallengeRoster>("course_challenge_roster_v1", { p_offering_id: offering, p_challenge_id: challenge, p_search: search, p_offset: offset }),
  };
}
export function challengeError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e?.code === "STALE_REVISION") return "This challenge or attempt changed in another tab. Refresh before continuing.";
  if (e?.code === "FORBIDDEN" || e?.code === "NOT_ENROLLED") return "You no longer have access to this course. Check your enrollment or teaching assignment.";
  if (e?.code === "DEADLINE_PASSED") return "The challenge has closed or your attempt was already submitted. Refresh to see its status.";
  return e?.message || "The request failed. Please retry.";
}
