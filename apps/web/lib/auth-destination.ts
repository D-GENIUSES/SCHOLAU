import "server-only";
import { isApiError } from "@scholau/api";
import { readRegistrationAcademic } from "@scholau/core";
import { getServerApi, getServerSupabase } from "@/lib/supabase/server";
import { lecturerApi } from "@/lib/lecturer-api";
import { chosenElectives, electiveGroups } from "@/lib/course-electives";

/** Resolve roles from the database, never from editable OAuth/signup metadata. */
export async function accountDestination(): Promise<string> {
  try {
    const api = await getServerApi();
    const profile = await api.getMyProfile();
    if (profile.roles.includes("admin")) return "/admin";
    if (profile.roles.includes("lecturer")) return "/lecturer";
    if (profile.roles.includes("student")) {
      if (profile.needs_onboarding) {
        const { data } = await (await getServerSupabase()).auth.getClaims();
        if (!readRegistrationAcademic(data?.claims?.user_metadata)) return "/onboarding";
      }
      if (profile.academic?.department.name === "Law") {
        const catalog = await api.getCatalog();
        if (electiveGroups(catalog.offerings).some((group) => group.required && chosenElectives(group.offerings, new Set()) < group.count)) return "/onboarding/courses";
      }
      return "/home";
    }
    const { application } = await lecturerApi(await getServerSupabase()).mine();
    return application ? "/lecturer/application" : "/home";
  } catch (error) {
    if (isApiError(error, "INVALID_STATE") && error.field_errors?.registration_required === true) return "/complete-registration";
    if (isApiError(error, "FORBIDDEN")) return "/auth/deactivated";
    if (isApiError(error, "UNAUTHENTICATED")) return "/auth/deactivated?reason=unavailable";
    return "/home";
  }
}
