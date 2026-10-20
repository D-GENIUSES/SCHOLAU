import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Only allow same-origin relative redirects. */
export function safeNext(next: string | null | undefined, fallback = "/home"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(next)) return fallback;
  const destination = new URL(next, "https://scholau.invalid");
  if (["/sign-in", "/sign-up", "/auth/callback", "/auth/confirm"].includes(destination.pathname.replace(/\/$/, ""))) return fallback;
  return next;
}
