import "server-only";
import { redirect } from "next/navigation";
import { isApiError, type Profile } from "@scholau/api";
import { readRegistrationAcademic } from "@scholau/core";
import { getServerApi, getServerSupabase } from "@/lib/supabase/server";

export type SessionResult =
  | { kind: "ok"; userId: string; profile: Profile }
  | { kind: "unavailable"; reference: string; message: string };

/**
 * Server-side session + profile. Redirects to sign-in when unauthenticated. Returns `unavailable`
 * (never a fabricated profile) when the backend can't be reached.
 */
export async function requireSession(nextPath: string): Promise<SessionResult> {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getClaims().catch(() => ({ data: null }));
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);

  try {
    const api = await getServerApi();
    const profile = await api.getMyProfile();
    return { kind: "ok", userId, profile };
  } catch (err) {
    if (isApiError(err, "UNAUTHENTICATED")) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
    if (isApiError(err, "FORBIDDEN")) redirect("/sign-in?deactivated=1");
    return {
      kind: "unavailable",
      reference: isApiError(err) ? err.reference : "SA-UNKNOWN",
      message: isApiError(err) ? err.message : "The service is unavailable right now.",
    };
  }
}

/** Allows saved signup details before course matching. Roles/enrollment stay backend-authorized. */
export async function requireOnboardedSession(nextPath: string): Promise<SessionResult> {
  const s = await requireSession(nextPath);
  if (s.kind === "ok" && s.profile.needs_onboarding) {
    const supabase = await getServerSupabase();
    const { data } = await supabase.auth.getClaims().catch(() => ({ data: null }));
    if (!readRegistrationAcademic(data?.claims?.user_metadata)) redirect("/onboarding");
  }
  return s;
}
