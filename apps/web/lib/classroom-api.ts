import { parseRpcError, type AnySupabaseClient } from "@scholau/api";
import type {
  ClassroomDetail,
  ClassroomInvite,
  ClassroomList,
  ClassroomMember,
  ClassroomSummary,
  LecturerQuizQuestion,
  QuizAudienceOption,
} from "@scholau/core";

export function classroomApi(client: AnySupabaseClient) {
  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error, status } = await client.rpc(name, args);
    if (error) throw parseRpcError(error, status);
    return data as T;
  }

  return {
    list: (archived = false) => rpc<ClassroomList>("list_classrooms_v1", { p_archived: archived }),
    options: (offering: string) => rpc<{ items: QuizAudienceOption[] }>("get_lecturer_quiz_audience_options_v1", { p_offering_id: offering }),
    create: (offering: string, title: string, offeringIds: string[]) =>
      rpc<{ classroom: ClassroomSummary }>("create_classroom_v1", { p_offering_id: offering, p_title: title, p_offering_ids: offeringIds }),
    invite: (id: string) => rpc<ClassroomInvite>("get_classroom_invite_v1", { p_id: id }),
    join: (id: string) => rpc<{ classroom: ClassroomSummary; already_member: boolean }>("join_classroom_v1", { p_id: id }),
    detail: (id: string) => rpc<ClassroomDetail>("get_classroom_v1", { p_id: id }),
    setJoinOpen: (id: string, open: boolean) =>
      rpc<{ classroom: ClassroomSummary }>("set_classroom_join_open_v1", { p_id: id, p_open: open }),
    archive: (id: string) => rpc<{ classroom: ClassroomSummary }>("archive_classroom_v1", { p_id: id }),
    members: (id: string, offset = 0) =>
      rpc<{ items: ClassroomMember[]; total: number }>("classroom_members_v1", { p_id: id, p_offset: offset }),
  };
}

export function classroomActivityApi(client: AnySupabaseClient) {
  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error, status } = await client.rpc(name, args);
    if (error) throw parseRpcError(error, status);
    return data as T;
  }
  return {
    saveQuiz: (id: string, classroomId: string, revision: number, data: Record<string, unknown>) =>
      rpc<{ quiz: import("@scholau/core").LecturerQuiz; questions: LecturerQuizQuestion[] }>("save_classroom_lecturer_quiz_v1", {
        p_id: id, p_classroom_id: classroomId, p_revision: revision, p_data: data,
      }),
    saveChallenge: (id: string, classroomId: string, revision: number, data: Record<string, unknown>) =>
      rpc<{ challenge: import("@scholau/core").CourseChallenge; questions: import("@scholau/core").ChallengeQuestion[] }>("save_classroom_course_challenge_v1", {
        p_id: id, p_classroom_id: classroomId, p_revision: revision, p_data: data,
      }),
  };
}
