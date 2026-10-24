import type { HomeSummary } from "@scholau/api";

const STORAGE_KEY = "scholau.home.offering.v1";

export function defaultHomeOfferingId(summary: HomeSummary): string | null {
  const fromContinue = summary.continue_learning?.offering_id;
  if (fromContinue && summary.enrolled_courses.some((c) => c.offering_id === fromContinue)) return fromContinue;
  return summary.enrolled_courses[0]?.offering_id ?? null;
}

export function readStoredHomeOfferingId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredHomeOfferingId(offeringId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, offeringId);
  } catch {
    /* ignore quota / private mode */
  }
}

export function resolveHomeOfferingId(summary: HomeSummary, stored: string | null): string | null {
  if (stored && summary.enrolled_courses.some((c) => c.offering_id === stored)) return stored;
  return defaultHomeOfferingId(summary);
}
