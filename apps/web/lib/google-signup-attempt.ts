export const GOOGLE_SIGNUP_ATTEMPT_COOKIE = "scholau-google-signup-attempt";
export const GOOGLE_SIGNUP_ATTEMPT_MAX_AGE_SECONDS = 600;

export function googleSignupStartedAt(cookie: string | undefined, attemptId: string | null, role: "student" | "lecturer" = "student"): number | null {
  if (!cookie || !attemptId) return null;
  const [savedId, startedText, savedRole = "student"] = cookie.split(":");
  const startedAt = Number(startedText);
  return savedId === attemptId && savedRole === role && Number.isFinite(startedAt) ? startedAt : null;
}

/** The OAuth user must have been created after this signup attempt began. */
export function isNewGoogleSignup(createdAt: string | undefined, cookie: string | undefined, attemptId: string | null, role: "student" | "lecturer" = "student"): boolean {
  const startedAt = googleSignupStartedAt(cookie, attemptId, role);
  const created = Date.parse(createdAt ?? "");
  return startedAt !== null && Number.isFinite(created)
    && created >= startedAt && created - startedAt <= GOOGLE_SIGNUP_ATTEMPT_MAX_AGE_SECONDS * 1000;
}
