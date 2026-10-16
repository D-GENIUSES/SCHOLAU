import { newRequestKey, parseRpcError, type AnySupabaseClient } from "@scholau/api";
import type { LecturerApplication, LecturerApplicationInput, LecturerApplicationStatus, LecturerOffering } from "@scholau/core";

/** Uses the caller's session. No service-role credentials or browser-writable authorization. */
export function lecturerApi(client: AnySupabaseClient) {
  async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error, status } = await client.rpc(name, args);
    if (error) throw parseRpcError(error, status);
    return data as T;
  }
  return {
    capabilities: async () => {
      const { data, error, status } = await client.from("app_config").select("feature_flags").eq("platform", "web").single();
      if (error) throw parseRpcError(error, status);
      return { lecturer_applications: data?.feature_flags?.lecturer_applications === true };
    },
    mine: () => rpc<{ application: LecturerApplication | null }>("get_my_lecturer_application_v1"),
    courses: () => rpc<{ items: LecturerOffering[] }>("get_my_lecturer_courses_v1"),
    list: (status: LecturerApplicationStatus | null, search: string, offset: number) => rpc<{ items: LecturerApplication[]; total: number; pending_count: number }>("admin_list_lecturer_applications_v1", { p_status: status, p_search: search, p_offset: offset, p_limit: 20 }),
    detail: (id: string) => rpc<{ application: LecturerApplication }>("admin_get_lecturer_application_v1", { p_application_id: id }),
    offerings: () => rpc<{ items: LecturerOffering[] }>("admin_get_lecturer_offerings_v1"),
    resubmit: (data: LecturerApplicationInput, revision: number, requestKey: string) => rpc<{ application: LecturerApplication }>("resubmit_lecturer_application_v1", { p_data: data, p_revision: revision, p_request_key: requestKey }),
    review: (a: { id: string; decision: Exclude<LecturerApplicationStatus, "pending">; message: string; internalNote: string; offeringIds: string[]; revision: number; requestKey: string }) => rpc<{ application: LecturerApplication }>("admin_review_lecturer_application_v1", { p_application_id: a.id, p_decision: a.decision, p_applicant_message: a.message, p_internal_note: a.internalNote, p_offering_ids: a.offeringIds, p_revision: a.revision, p_request_key: a.requestKey }),
    assign: (id: string, offeringIds: string[], revision: number, requestKey = newRequestKey()) => rpc<{ application: LecturerApplication }>("admin_assign_lecturer_courses_v1", { p_application_id: id, p_offering_ids: offeringIds, p_revision: revision, p_request_key: requestKey }),
  };
}
export function registrationError(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (e?.code === "STALE_REVISION" || e?.code === "INVALID_STATE") return "This application changed. Refresh it before trying again.";
  if (e?.code === "FORBIDDEN") return "This action is not allowed. Check your access and the applicant’s email verification.";
  if (e?.code === "VALIDATION_FAILED") return "Check the details, feedback and selected courses, then try again.";
  return "We couldn’t load or save the application. Please retry. Your existing account has not been changed.";
}
