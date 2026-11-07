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

export function studyInvitation(topic: string) {
  return topic
    ? `Think you can get this one right? Try this ${topic} question on ScholAu and challenge a friend.`
    : "Think you can get this one right? Try this question on ScholAu and challenge a friend.";
}