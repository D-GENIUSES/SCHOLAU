interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

export function isInvalidCredentials(error: AuthErrorLike): boolean {
  return error.code === "invalid_credentials" || /invalid login credentials/i.test(error.message ?? "");
}

export function isEmailNotConfirmed(error: AuthErrorLike): boolean {
  return error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message ?? "");
}

/** Plain-language copy for Supabase Auth errors. Never echoes raw server text. */
export function authErrorMessage(error: AuthErrorLike): string {
  if (isInvalidCredentials(error)) return "Email or password is incorrect.";
  if (isEmailNotConfirmed(error)) return "Confirm your email address before signing in.";
  switch (error.code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a minute and try again.";
    case "weak_password":
      return "Choose a stronger password (at least 8 characters, harder to guess).";
    case "same_password":
      return "Choose a password different from your current one.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try signing in instead.";
    case "signup_disabled":
      return "Sign-ups are closed right now. Please try again later.";
    case "session_not_found":
    case "session_expired":
      return "Your session has expired. Request a new link and try again.";
  }
  if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
  if (/fetch|network/i.test(error.message ?? "")) return "You're offline or the connection dropped. Please retry.";
  return "Something went wrong. Please try again.";
}
