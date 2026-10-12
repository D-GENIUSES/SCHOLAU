/** Stable ScholAu error codes (see supabase/migrations/*_rpc_foundation.sql). */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_PROFILE",
  "NOT_ENROLLED",
  "CONTENT_UNAVAILABLE",
  "ATTEMPT_ACTIVE",
  "DEADLINE_PASSED",
  "STALE_REVISION",
  "BATTLE_FULL",
  "QUEUE_EXPIRED",
  "VERSION_UNSUPPORTED",
  "RATE_LIMITED",
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "SLOT_BUSY",
  "INVALID_STATE",
  "MAINTENANCE",
  "NETWORK",
  "UNKNOWN",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ScholauErrorShape {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  field_errors?: Record<string, unknown>;
  /** Client-side correlation reference for support (never contains secrets). */
  reference?: string;
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

/** Plain-language copy per code. Server messages are preferred when present and specific. */
export const ERROR_COPY: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Please sign in to continue.",
  FORBIDDEN: "You don't have permission to do that.",
  INVALID_PROFILE: "Your academic profile is missing or invalid. Please review it.",
  NOT_ENROLLED: "Enroll in this course first.",
  CONTENT_UNAVAILABLE: "This content is under review.",
  ATTEMPT_ACTIVE: "You already have an attempt in progress.",
  DEADLINE_PASSED: "The time for this has ended.",
  STALE_REVISION: "Your data is out of date. We refreshed it — please try again.",
  BATTLE_FULL: "This battle can no longer be joined.",
  QUEUE_EXPIRED: "This invitation or queue entry has expired.",
  VERSION_UNSUPPORTED: "Please refresh to get the latest version of ScholAu.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  VALIDATION_FAILED: "Some details need fixing.",
  NOT_FOUND: "We couldn't find that.",
  SLOT_BUSY: "You already have a live battle or queue entry.",
  INVALID_STATE: "That action isn't available right now.",
  MAINTENANCE: "ScholAu is under maintenance. Please try again soon.",
  NETWORK: "You're offline or the connection dropped. Please retry.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export function errorMessage(err: Pick<ScholauErrorShape, "code" | "message"> | null | undefined): string {
  if (!err) return ERROR_COPY.UNKNOWN;
  if (err.message && err.code !== "UNKNOWN" && err.code !== "NETWORK") return err.message;
  return ERROR_COPY[err.code] ?? ERROR_COPY.UNKNOWN;
}

/** Maps backend `field_errors` values (e.g. "invalid", "required") to readable copy. */
export function fieldErrorMessage(value: unknown): string {
  if (typeof value !== "string") return "This field is invalid.";
  switch (value) {
    case "required":
      return "This field is required.";
    case "invalid":
      return "This selection is not valid.";
    case "change_limit_reached":
      return "You've already used your academic profile change for this period.";
    default:
      return value.charAt(0).toUpperCase() + value.slice(1) + (value.endsWith(".") ? "" : ".");
  }
}
