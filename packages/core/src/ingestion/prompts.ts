import type { BattleMix } from "./types";

export function buildIngestionSystemPrompt(input: {
  courseCode: string;
  moduleTitle: string;
  filename: string;
  battleMix: BattleMix;
  skipLogicalKeys?: string[];
}): string {
  const skip =
    input.skipLogicalKeys?.length ?
      `\nDo NOT recreate content for these logical_question_keys (already in course): ${input.skipLogicalKeys.join(", ")}.`
    : "";
  return `You are building ScholAu course content. Return JSON only matching this shape:
{
  "title": string,
  "objective": string,
  "module_title": string,
  "blocks": canonical lesson — heading "Understand the idea", paragraph (80+ chars), example callout, warning callout, heading "What to remember", summary paragraph, checkpoint with 4 options,
  "flashcards": 8-12 cards { front, back, tag? } — one idea per card, backs under 520 chars, exam-focused,
  "learning_questions": MCQ review questions with 4 options,
  "battle_questions": mix answer_format standard (4 MCQ), worked_solution (4 options with steps[]), fill_in_gap (gaps[].accepted_answers with aliases for voice)
}
Battle mix weights: standard ${input.battleMix.standard}, worked_solution ${input.battleMix.worked_solution}, fill_in_gap ${input.battleMix.fill_in_gap}.
Course: ${input.courseCode}. Module: ${input.moduleTitle}. Source: ${input.filename}. Ground every field in the uploaded file.${skip}`;
}
