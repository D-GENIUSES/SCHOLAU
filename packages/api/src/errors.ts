import { type ErrorCode, type ScholauErrorShape, ERROR_COPY, isErrorCode } from "@scholau/core";

/** Error thrown by every API function. Branch on `code` only. */
export class ScholauApiError extends Error implements ScholauErrorShape {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly field_errors?: Record<string, unknown>;
  readonly status?: number;
  readonly reference: string;

  constructor(shape: ScholauErrorShape & { status?: number }) {
    super(shape.message);
    this.name = "ScholauApiError";
    this.code = shape.code;
    this.retryable = shape.retryable;
    this.field_errors = shape.field_errors;
    this.status = shape.status;
    this.reference = shape.reference ?? newReference();
  }

  toJSON(): ScholauErrorShape {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      field_errors: this.field_errors,
      reference: this.reference,
    };
  }
}

function newReference(): string {
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SA-${Date.now().toString(36).toUpperCase()}-${rnd}`;
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
}

/**
 * Parses the backend error convention:
 *   error.message = ScholAu code, error.details = JSON {code, message, retryable, field_errors?},
 *   error.code = "PTxxx" (transport detail only).
 */
export function parseRpcError(error: unknown, status?: number): ScholauApiError {
  if (error instanceof ScholauApiError) return error;

  if (isNetworkError(error)) {
    return new ScholauApiError({ code: "NETWORK", message: ERROR_COPY.NETWORK, retryable: true, status });
  }

  const e = (error ?? {}) as PostgrestLikeError;
  if (typeof e.details === "string" && e.details.startsWith("{")) {
    try {
      const parsed = JSON.parse(e.details) as Partial<ScholauErrorShape> & { code?: string };
      if (parsed.code && isErrorCode(parsed.code)) {
        return new ScholauApiError({
          code: parsed.code,
          message: parsed.message || ERROR_COPY[parsed.code],
          retryable: Boolean(parsed.retryable),
          field_errors: parsed.field_errors,
          status: status ?? httpFromSqlState(e.code),
        });
      }
    } catch {
      // fall through
    }
  }

  if (e.message && isErrorCode(e.message)) {
    return new ScholauApiError({
      code: e.message,
      message: e.hint || ERROR_COPY[e.message],
      retryable: e.message === "RATE_LIMITED" || e.message === "STALE_REVISION" || e.message === "MAINTENANCE",
      status,
    });
  }

  // PostgREST / auth transport errors.
  const http = status ?? httpFromSqlState(e.code);
  if (e.code === "PGRST301" || e.code === "42501" || http === 401) {
    return new ScholauApiError({ code: "UNAUTHENTICATED", message: ERROR_COPY.UNAUTHENTICATED, retryable: false, status: http });
  }
  if (http === 404 || e.code === "PGRST202") {
    return new ScholauApiError({ code: "NOT_FOUND", message: ERROR_COPY.NOT_FOUND, retryable: false, status: http });
  }
  if (http !== undefined && http >= 500) {
    return new ScholauApiError({ code: "UNKNOWN", message: ERROR_COPY.UNKNOWN, retryable: true, status: http });
  }
  return new ScholauApiError({ code: "UNKNOWN", message: ERROR_COPY.UNKNOWN, retryable: false, status: http });
}

function httpFromSqlState(code: string | undefined): number | undefined {
  if (code && /^PT\d{3}$/.test(code)) return Number(code.slice(2));
  return undefined;
}

export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) return true;
  const msg = (error as { message?: unknown }).message;
  return typeof msg === "string" && /Failed to fetch|NetworkError|network request failed|fetch failed/i.test(msg);
}

export function isApiError(error: unknown, code?: ErrorCode): error is ScholauApiError {
  return error instanceof ScholauApiError && (code === undefined || error.code === code);
}
