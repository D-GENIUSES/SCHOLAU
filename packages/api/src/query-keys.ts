import type { LeaderboardScope } from "@scholau/core";

export const qk = {
  all: ["scholau"] as const,
  profile: () => ["scholau", "profile"] as const,
  home: () => ["scholau", "home"] as const,
  catalog: () => ["scholau", "catalog"] as const,
  onboarding: (u?: string | null, f?: string | null, p?: string | null) =>
    ["scholau", "onboarding", u ?? null, f ?? null, p ?? null] as const,
  course: (offeringId: string) => ["scholau", "course", offeringId] as const,
  lesson: (lessonId: string) => ["scholau", "lesson", lessonId] as const,
  attempt: (attemptId: string) => ["scholau", "attempt", attemptId] as const,
  notifications: () => ["scholau", "notifications"] as const,
  liveBattle: () => ["scholau", "battle", "live"] as const,
  battle: (battleId: string) => ["scholau", "battle", battleId] as const,
  battles: () => ["scholau", "battles"] as const,
  leaderboard: (scope: LeaderboardScope) => ["scholau", "leaderboard", scope] as const,
  appConfig: () => ["scholau", "app-config"] as const,
  admin: {
    all: ["scholau", "admin"] as const,
    counts: () => ["scholau", "admin", "counts"] as const,
    reports: (state?: string | null) => ["scholau", "admin", "reports", state ?? "all"] as const,
    offerings: () => ["scholau", "admin", "offerings"] as const,
    lessons: (status?: string | null) => ["scholau", "admin", "lessons", status ?? "all"] as const,
    questions: (status?: string | null) => ["scholau", "admin", "questions", status ?? "all"] as const,
    assessments: (status?: string | null) => ["scholau", "admin", "assessments", status ?? "all"] as const,
    question: (id: string) => ["scholau", "admin", "question", id] as const,
    battles: (state?: string | null) => ["scholau", "admin", "battles", state ?? "all"] as const,
    entitlements: () => ["scholau", "admin", "entitlements"] as const,
    audit: (entityType?: string | null) => ["scholau", "admin", "audit", entityType ?? "all"] as const,
  },
};
