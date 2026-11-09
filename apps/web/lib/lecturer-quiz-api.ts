import { isApiError, parseRpcError, ScholauApiError, type AnySupabaseClient } from "@scholau/api";
import type {
  LecturerQuiz,
  LecturerQuizDetail,
  LecturerQuizDraft,
  LecturerQuizExport,
  LecturerQuizImportJob,
  LecturerQuizList,
  LecturerQuizQuestion,
  LecturerQuizRoster,
} from "@scholau/core";

import type { CaptureShortcut, WindowActivity } from "./assessment-activity";

export type QuizIntegrityFlag = { user_id: string; attempt_number: number; kind: WindowActivity | CaptureShortcut; count: number };

export function lecturerQuizApi(client: AnySupabaseClient) {
  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error, status } = await client.rpc(name, args);
    if (error?.message === "ATTEMPT_LIMIT") {
      throw new ScholauApiError({ code: "INVALID_STATE", message: "You have used all allowed attempts.", retryable: false });
    }
    if (error) throw parseRpcError(error, status);
    return data as T;
  }
  const toPayload = (data: LecturerQuizDraft) => ({
    title: data.title,
    instructions: data.instructions,
    duration_minutes: data.duration_minutes,
    opens_at: data.opens_at ?? null,
    closes_at: data.closes_at ?? null,
    max_attempts: data.max_attempts ?? 1,
    feedback_mode: data.feedback_mode ?? "after_submit",
    questions: data.questions,
  });
  return {
    list: (offering: string, offset = 0) =>
      rpc<LecturerQuizList>("list_course_quizzes_v1", { p_offering_id: offering, p_offset: offset }),
    save: (id: string, offering: string, revision: number, data: LecturerQuizDraft) =>
      rpc<{ quiz: LecturerQuiz; questions: LecturerQuizQuestion[] }>("save_lecturer_quiz_v1", {
        p_id: id,
        p_offering_id: offering,
        p_revision: revision,
        p_data: toPayload(data),
      }),
    publish: (id: string, revision: number) =>
      rpc<{ quiz: LecturerQuiz }>("publish_lecturer_quiz_v1", { p_id: id, p_revision: revision }),
    cancel: (id: string) => rpc<{ cancelled: boolean }>("cancel_lecturer_quiz_draft_v1", { p_id: id }),
    detail: (id: string) => rpc<LecturerQuizDetail>("get_course_quiz_v1", { p_id: id }),
    start: (id: string, matric: string) =>
      rpc<LecturerQuizDetail>("start_lecturer_quiz_attempt_v1", { p_quiz_id: id, p_matric_number: matric }),
    answer: (id: string, question: number, option: number, revision: number) =>
      rpc<LecturerQuizDetail>("save_lecturer_quiz_answer_v1", {
        p_quiz_id: id,
        p_display_question: question,
        p_display_option: option,
        p_revision: revision,
      }),
    submit: (id: string, revision: number) =>
      rpc<LecturerQuizDetail>("submit_lecturer_quiz_attempt_v1", { p_quiz_id: id, p_revision: revision }),
    roster: (offering: string, quizId: string, search = "", offset = 0) =>
      rpc<LecturerQuizRoster>("lecturer_quiz_roster_v1", {
        p_offering_id: offering,
        p_quiz_id: quizId,
        p_search: search,
        p_offset: offset,
      }),
    integrity: (quizId: string, students: string[]) =>
      rpc<{ items: QuizIntegrityFlag[] }>("get_lecturer_quiz_integrity_v1", { p_quiz_id: quizId, p_students: students }),
    exportResults: (quizId: string) => rpc<LecturerQuizExport>("export_lecturer_quiz_results_v1", { p_quiz_id: quizId }),
    startImport: (quizId: string, offering: string, objectKey: string, mimeType: string) =>
      rpc<{ job_id: string }>("start_lecturer_quiz_import_v1", {
        p_quiz_id: quizId,
        p_offering_id: offering,
        p_object_key: objectKey,
        p_mime_type: mimeType,
      }),
    getImport: (jobId: string) => rpc<LecturerQuizImportJob>("get_lecturer_quiz_import_v1", { p_job_id: jobId }),
  };
}

export function lecturerQuizError(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === "STALE_REVISION") return "This quiz changed in another tab. Refresh before continuing.";
    if (error.code === "FORBIDDEN" || error.code === "NOT_ENROLLED") return "You no longer have access to this course.";
    if (error.code === "DEADLINE_PASSED") return "Time is up or the quiz window has closed.";
    if (error.code === "INVALID_STATE") return error.message || "This quiz is not open right now.";
    if (error.code === "VALIDATION_FAILED") return error.message;
    return error.message;
  }
  const e = error as { code?: string; message?: string };
  if (e?.code === "STALE_REVISION") return "This quiz changed in another tab. Refresh before continuing.";
  if (e?.code === "VALIDATION_FAILED" && e.message) return e.message;
  return e?.message || "The request failed. Please retry.";
}
