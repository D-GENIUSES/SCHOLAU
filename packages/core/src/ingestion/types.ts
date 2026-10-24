import type { LessonBlock } from "../domain";

export type IngestionTopicMode = "existing_module" | "new_module" | "auto_segment";

export type IngestionFlashcard = {
  front: string;
  back: string;
  tag?: "focus" | "section" | "tip" | "checkpoint" | "diagram" | "recap";
};

export type IngestionGap = {
  index: number;
  accepted_answers: string[];
};

export type IngestionQuestion = {
  course_code: string;
  logical_question_key: string;
  pool: "learning" | "battle";
  usage: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  prompt: string;
  explanation: string;
  source_reference: string;
  answer_format?: "standard" | "worked_solution" | "fill_in_gap";
  battle_seconds?: number;
  battle_reading_seconds?: number;
  options?: { label: string; body: string; steps?: string[] }[];
  correct_option?: string;
  gaps?: IngestionGap[];
};

export type IngestionLesson = {
  course_code: string;
  module_position: number;
  module_title: string;
  lesson_position: number;
  title: string;
  objective: string;
  estimated_minutes: number;
  blocks: LessonBlock[];
  flashcards: IngestionFlashcard[];
  source_reference: string;
  logical_key?: string;
};

export type GeminiConceptResult = {
  title: string;
  objective?: string;
  module_title?: string;
  blocks: LessonBlock[];
  flashcards: IngestionFlashcard[];
  learning_questions: IngestionQuestion[];
  battle_questions: IngestionQuestion[];
};

export type BattleMix = {
  standard: number;
  worked_solution: number;
  fill_in_gap: number;
};
