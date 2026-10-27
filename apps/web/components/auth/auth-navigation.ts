import { safeNext } from "@/lib/utils";
import { param } from "./params";

export type AuthContext = { next?: string; error?: string; deactivated?: string };

export function authContext(params: Record<string, string | string[] | undefined>): AuthContext {
  const next = param(params.next);
  return {
    next: next ? safeNext(next, "/auth/continue") : undefined,
    error: param(params.error),
    deactivated: param(params.deactivated),
  };
}

export function authHref(path: "/sign-in" | "/sign-up", context: AuthContext = {}, options: { role?: "student" | "lecturer"; method?: "email" } = {}) {
  const query = new URLSearchParams();
  if (context.next) query.set("next", safeNext(context.next, "/auth/continue"));
  if (context.error === "oauth" || context.error === "link") query.set("error", context.error);
  if (context.deactivated === "1") query.set("deactivated", "1");
  if (options.role) query.set("role", options.role);
  if (options.method) query.set("method", options.method);
  return query.size ? `${path}?${query}` : path;
}
