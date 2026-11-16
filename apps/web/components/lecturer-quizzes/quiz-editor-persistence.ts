import type { LecturerQuizDraft, QuizEditorStep } from "@scholau/core";

const KEY_PREFIX = "scholau:lecturer-quiz-editor:";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type LocalQuizEditorBackup = {
  offeringId: string;
  quizId: string;
  revision: number | null;
  step: QuizEditorStep;
  draft: LecturerQuizDraft;
  openQuestions?: Record<number, boolean>;
  savedAt: string;
};

function storageKey(offeringId: string, quizId: string) {
  return `${KEY_PREFIX}${offeringId}:${quizId || "new"}`;
}

export function readLocalQuizBackup(offeringId: string, quizId: string): LocalQuizEditorBackup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(offeringId, quizId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalQuizEditorBackup;
    if (parsed.offeringId !== offeringId) return null;
    if (Date.now() - new Date(parsed.savedAt).getTime() > MAX_AGE_MS) {
      localStorage.removeItem(storageKey(offeringId, quizId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalQuizBackup(backup: LocalQuizEditorBackup) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(backup.offeringId, backup.quizId || "new"), JSON.stringify(backup));
  } catch {
    // Storage full or private mode — ignore.
  }
}

export function clearLocalQuizBackup(offeringId: string, quizId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey(offeringId, quizId || "new"));
  localStorage.removeItem(storageKey(offeringId, "new"));
}