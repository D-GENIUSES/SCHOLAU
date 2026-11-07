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
      return "Sign in again to share this question.";
    case "not_enrolled":
      return "Enroll in this course to share questions from it.";
    case "not_shareable":
      return "This question can't be shared because it's tied to a protected assessment.";
  }
}

export function studyInvitation(topic: string) {
  return topic
    ? `Think you can get this one right? Try this ${topic} question on ScholAu and challenge a friend.`
    : "Think you can get this one right? Try this question on ScholAu and challenge a friend.";
}