import type { LessonBlock } from "../domain";
import type { IngestionFlashcard } from "./types";

/** ScholAu teaching template (matches build-course-material-bundles.py). */
export function buildCanonicalBlocks(input: {
  explanation: string;
  example: string;
  pitfall: string;
  summary: string;
  checkpoint: { question: string; options: string[]; correct_index: number; explanation: string };
}): LessonBlock[] {
  return [
    { type: "heading", level: 2, text: "Understand the idea" },
    { type: "paragraph", text: input.explanation },
    { type: "callout", tone: "example", title: "Work through an example", text: input.example },
    { type: "callout", tone: "warning", title: "Avoid this mistake", text: input.pitfall },
    { type: "heading", level: 2, text: "What to remember" },
    { type: "paragraph", text: input.summary },
    {
      type: "checkpoint",
      question: input.checkpoint.question,
      options: input.checkpoint.options,
      correct_index: input.checkpoint.correct_index,
      explanation: input.checkpoint.explanation,
    },
  ];
}

export function defaultFlashcards(title: string, objective: string, summary: string): IngestionFlashcard[] {
  return [
    { front: `Exam focus: ${title}`, back: objective, tag: "focus" },
    { front: "What to remember", back: summary, tag: "recap" },
  ];
}

export function estimateMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.ceil(words / 100));
}
