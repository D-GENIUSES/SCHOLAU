import { newRequestKey, parseRpcError } from "@scholau/api";
import { getBrowserSupabase } from "@/lib/supabase/browser";
export type UserCategory = "student" | "lecturer" | "other";
export type UserAssignment = { id: string; code: string; title: string; status: string };
export type ManagedUser = {
 avatar_path: string | null;
 online?: boolean;
 id: string; email: string | null; display_name: string | null; registered_at: string | null;
 last_sign_in_at: string | null; email_verified: boolean; deactivated_at: string | null;
 updated_at: string | null; has_profile: boolean; category: UserCategory; roles: string[];
 application_status: string | null; assignments: UserAssignment[];
 xp_total?: number;
};
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
 const { data, error, status } = await getBrowserSupabase().rpc(name,args);
 if (error) throw parseRpcError(error,status);
 return data as T;
}
export const adminUsersApi = {
 awardXp: (userId: string, amount: number, reason: string, requestKey: string) => rpc<{amount: number; xp_total: number; replayed: boolean}>("admin_award_xp_v1", {p_user_id:userId,p_amount:amount,p_reason:reason,p_request_key:requestKey}),
 list: (category: string, status: string, search: string, offset: number) => rpc<{items: ManagedUser[]; total: number}>("admin_list_users_v1",{p_category:category||null,p_status:status||null,p_search:search,p_offset:offset,p_limit:20}),
 detail: (id: string) => rpc<{user: ManagedUser}>("admin_get_user_v1",{p_user_id:id}),
 freeze: (user: ManagedUser, frozen: boolean, reason: string, requestKey=newRequestKey()) => rpc<{user: ManagedUser}>("admin_set_user_frozen_v1",{p_user_id:user.id,p_frozen:frozen,p_expected_updated_at:user.updated_at,p_reason:reason,p_request_key:requestKey}),
 assign: (user: ManagedUser, ids: string[], requestKey=newRequestKey()) => rpc<{user: ManagedUser}>("admin_set_user_courses_v1",{p_user_id:user.id,p_offering_ids:ids,p_expected_offering_ids:user.assignments.map(a=>a.id),p_request_key:requestKey}),
 remove: (user: ManagedUser, email: string, reason: string, requestKey=newRequestKey()) => rpc<{deleted: boolean}>("admin_delete_user_v1",{p_user_id:user.id,p_confirm_email:email,p_expected_updated_at:user.updated_at,p_reason:reason,p_request_key:requestKey}),
};
export function userManagementError(error: unknown) {
 const code=(error as {code?: string})?.code;
 if(code==="STALE_REVISION") return "This account or its assignments changed. Close this panel and reopen it before trying again.";
 if(code==="FORBIDDEN") return "This action is not allowed. Check your administrator access and the account's role.";
 if(code==="NOT_FOUND") return "This account no longer exists. Refresh the directory.";
 if(code==="INVALID_STATE") return "The account must be an active, approved lecturer before assigning courses.";
 if(code==="VALIDATION_FAILED") return "Check the confirmation, reason and selected courses.";
 return "The request could not be confirmed. Refresh the directory before retrying.";
}
