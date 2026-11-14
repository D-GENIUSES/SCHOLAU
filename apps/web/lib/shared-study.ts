import type { ReportTargetType } from "@scholau/core";

export type CatalogSource = { course: string; topic: string } & (
  { kind: "catalog"; key: string } |
  { kind: "catalog-checkpoint"; lesson: string; checkpoint: number }
);

export type StudySource = CatalogSource |
  { kind: "bank"; version: string } |
  { kind: "checkpoint"; version: string; checkpoint: number };

export type StudyReport = { targetType: ReportTargetType; targetId?: string; reference?: string };
export type SharedStudyQuestion = {
  topic: string;
  prompt: string;
  options: { id: string; body: string }[];
  report: StudyReport;
};
export type SharedStudyFeedback = {
  correct: boolean;
  answer: string;
  explanation: string;
  steps?: string[] | null;
};
export type StudyLink = { url: string; topic: string };
export type StudyShareErrorCode = "unauthenticated" | "not_enrolled" | "not_shareable";

export function studyShareErrorMessage(code: StudyShareErrorCode) {
  switch (code) {
    case "unauthenticated":
      return "You're signed out — log in and try sharing again.";
    case "not_enrolled":
      return "You need to be on this course before you can share its questions.";
    case "not_shareable":
      return "This one's from a locked assessment, so it can't be shared.";
  }
}

export function studyInvitation(topic: string) {
  return topic
    ? `Stuck on ${topic}? Try this question on ScholAu — bet your friend can't beat you.`
    : "Try this question on ScholAu — bet your friend can't beat you.";
}

export function studyShareText(topic: string, url: string) {
  return `${studyInvitation(topic)}\n${url}`;
}