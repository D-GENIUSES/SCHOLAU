import { z } from "zod";
import type { LecturerQuizDraft, LecturerQuizQuestion } from "./lecturer-quizzes";

const optionText = z.string().trim().min(1).max(1000);

export const lecturerQuizQuestionSchema = z
  .object({
    prompt: z.string().trim().min(1).max(2000),
    options: z.array(optionText).min(2).max(6),
    correct: z.number().int().min(0),
    explanation: z.string().max(4000).optional(),
  })
  .superRefine((q, ctx) => {
    if (q.correct >= q.options.length) {
      ctx.addIssue({ code: "custom", message: "Mark the correct option for each question." });
    }
    const distinct = new Set(q.options.map(o => o.toLowerCase()));
    if (distinct.size !== q.options.length) {
      ctx.addIssue({ code: "custom", message: "Options must be distinct." });
    }
  });

export function isCompleteQuizQuestion(q: LecturerQuizQuestion): boolean {
  return lecturerQuizQuestionSchema.safeParse(q).success;
}

/** Questions safe to send to save_lecturer_quiz_v1 (incomplete rows stay in the editor only). */
export function completeQuizQuestions(questions: LecturerQuizQuestion[]): LecturerQuizQuestion[] {
  return questions.filter(isCompleteQuizQuestion);
}

export const lecturerQuizScheduleSchema = z
  .object({
    title: z.string().trim().min(1, "Add a quiz title.").max(160),
    instructions: z.string().max(4000),
    duration_minutes: z.number().int().min(1).max(180),
    opens_at: z.string().min(1, "Set when the quiz opens."),
    closes_at: z.string().min(1, "Set when the quiz closes."),
    max_attempts: z.number().int().min(1).max(3).optional(),
    feedback_mode: z.enum(["after_submit", "immediate"]).optional(),
  })
  .refine(
    d => new Date(d.closes_at).getTime() > new Date(d.opens_at).getTime(),
    { message: "Close time must be after open time.", path: ["closes_at"] },
  );

export type QuizEditorStep = "Schedule" | "Questions" | "Review";

export function scheduleStepIssue(draft: Pick<LecturerQuizDraft, "title" | "instructions" | "duration_minutes" | "opens_at" | "closes_at" | "max_attempts" | "feedback_mode">): string | null {
  const parsed = lecturerQuizScheduleSchema.safeParse({
    title: draft.title,
    instructions: draft.instructions ?? "",
    duration_minutes: draft.duration_minutes,
    opens_at: draft.opens_at ?? "",
    closes_at: draft.closes_at ?? "",
    max_attempts: draft.max_attempts ?? 1,
    feedback_mode: draft.feedback_mode ?? "after_submit",
  });
  if (parsed.success) return null;
  return parsed.error.issues[0]?.message ?? "Fix the schedule fields.";
}

export function publishBlockers(draft: LecturerQuizDraft, publish: boolean): string | null {
  const schedule = scheduleStepIssue(draft);
  if (schedule) return schedule;
  const ready = completeQuizQuestions(draft.questions);
  if (publish) {
    if (!ready.length) return "Add at least one complete question before publishing.";
    if (ready.length < draft.questions.length) return "Complete or remove incomplete questions before publishing.";
    if (!draft.closes_at || new Date(draft.closes_at).getTime() <= Date.now()) {
      return "Close time must be in the future.";
    }
  }
  return null;
}
