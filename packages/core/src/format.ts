/** Pure display helpers. No business decisions are made here. */

const nf = new Intl.NumberFormat("en-NG");

export function formatXp(xp: number | null | undefined): string {
  return `${nf.format(xp ?? 0)} XP`;
}

export function formatXpDelta(xp: number | null | undefined): string {
  const v = xp ?? 0;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf.format(Math.abs(v))} XP`;
}

export function formatNumber(n: number | null | undefined): string {
  return nf.format(n ?? 0);
}

export function formatPercent(n: number | null | undefined, digits = 0): string {
  return `${(n ?? 0).toFixed(digits)}%`;
}

/** mm:ss for remaining milliseconds (clamped at 0). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Human duration for intros, e.g. 1800 -> "30 minutes". */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "Untimed";
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const h = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${h} hour${h === 1 ? "" : "s"}${rem ? ` ${rem} min` : ""}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(iso));
}

export function formatRelative(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - now;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), "second");
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.round(diff / 86_400_000), "day");
}

export function formatStreak(days: number | null | undefined): string {
  const d = days ?? 0;
  return `${d} day${d === 1 ? "" : "s"}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${nf.format(n)} ${n === 1 ? one : many}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
