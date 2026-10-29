export const GOOGLE_SIGNUP_ATTEMPT_COOKIE = "scholau-google-signup-attempt";
export const GOOGLE_SIGNUP_ATTEMPT_MAX_AGE_SECONDS = 600;

/** The OAuth user must have been created after this signup attempt began. */
export function isNewGoogleSignup(createdAt: string | undefined, cookie: string | undefined, attemptId: string | null): boolean {
  if (!createdAt || !cookie || !attemptId) return false;
  const [savedId, startedText] = cookie.split(":");
  const startedAt = Number(startedText);
  const created = Date.parse(createdAt);
  return savedId === attemptId && Number.isFinite(startedAt) && Number.isFinite(created)
    && created >= startedAt && created - startedAt <= GOOGLE_SIGNUP_ATTEMPT_MAX_AGE_SECONDS * 1000;
}
