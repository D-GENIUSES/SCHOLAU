import "server-only";
import { createScholauApi, isApiError } from "@scholau/api";
import { readRegistrationAcademic, ServerClock } from "@scholau/core";
import { getServerSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";
import { lecturerApi } from "@/lib/lecturer-api";
import { chosenElectives, electiveGroups } from "@/lib/course-electives";

/** Resolve roles from the database, never from editable OAuth/signup metadata. */
export async function accountDestination(next?: string, client?: Awaited<ReturnType<typeof getServerSupabase>>): Promise<string> {
  try {
    const supabase = client ?? await getServerSupabase();
    const api = createScholauApi(supabase, { clock: new ServerClock() });
    const requested = safeNext(next, "/home");
    // Auth pages cannot be a successful sign-in destination.
    const path = new URL(requested, "https://scholau.com").pathname;
    const destination = ["/sign-in", "/sign-up", "/auth/continue", "/auth/callback"].includes(path) ? "/home" : requested;
    const profile = await api.getMyProfile();
    if (profile.roles.includes("admin")) return "/admin";
    if (profile.roles.includes("lecturer")) return "/lecturer";
    if (profile.roles.includes("student")) {
      if (profile.needs_onboarding) {
        const { data } = await supabase.auth.getClaims();
        if (!readRegistrationAcademic(data?.claims?.user_metadata)) return "/onboarding";
      }
      if (profile.academic?.department.name === "Law") {
        const catalog = await api.getCatalog();
        if (electiveGroups(catalog.offerings).some((group) => group.required && chosenElectives(group.offerings, new Set()) < group.count)) return "/onboarding/courses";
      }
      return destination;
    }
    const { application } = await lecturerApi(supabase).mine();
    return application ? "/lecturer/application" : "/home";
  } catch (error) {
    if (isApiError(error, "INVALID_STATE") && error.field_errors?.registration_required === true) return "/complete-registration";
    if (isApiError(error, "FORBIDDEN")) return "/auth/deactivated";
    if (isApiError(error, "UNAUTHENTICATED")) return "/auth/deactivated?reason=unavailable";
    return "/home";
  }
}
