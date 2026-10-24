import { buildCanonicalBlocks, defaultFlashcards, estimateMinutes } from "./canonical-lesson";
import { stableLogicalKey } from "./dedup";
import type { BattleMix, GeminiConceptResult, IngestionQuestion } from "./types";

/** Deterministic fallback when GEMINI_API_KEY is unset (dev / tests). */
export function stubConceptFromUpload(input: {
  courseCode: string;
  sourceSha256: string;
  filename: string;
  moduleTitle: string;
  modulePosition: number;
  lessonPosition: number;
  battleMix: BattleMix;
}): GeminiConceptResult {
  const title = input.filename.replace(/\.[^.]+$/, "").slice(0, 80) || "Uploaded concept";
  const explanation =
    "This lesson introduces the main ideas from your uploaded material. Read the example and avoid the common mistake before you try the practice check.";
  const example = "Apply the definition to a short scenario from your lecture notes.";
  const pitfall = "Do not confuse related terms that appear close together in the source.";
  const summary = "State the core idea in your own words and link it to one real example.";
  const checkpointQ = "Which statement best matches the main idea of this upload?";
  const options = ["It repeats the title only", "It explains the core concept", "It is unrelated to the course", "It replaces all assessments"];
  const blocks = buildCanonicalBlocks({
    explanation: `${explanation} Source: ${input.filename}.`,
    example,
    pitfall,
    summary,
    checkpoint: { question: checkpointQ, options, correct_index: 1, explanation: summary },
  });
  const text = [explanation, example, pitfall, summary].join(" ");
  const keyBase = stableLogicalKey(input.courseCode, input.sourceSha256, 1, input.lessonPosition);
  const learningQ: IngestionQuestion = {
    course_code: input.courseCode,
    logical_question_key: `${keyBase}-lq`,
    pool: "learning",
    usage: ["review", "practice"],
    difficulty: "beginner",
    prompt: checkpointQ,
    options: options.map((body, i) => ({ label: String.fromCharCode(65 + i), body })),
    correct_option: "B",
    explanation: summary,
    source_reference: `${input.filename} [source SHA-256 ${input.sourceSha256}]`,
    answer_format: "standard",
  };
  const battleQuestions: IngestionQuestion[] = [];
  if (input.battleMix.fill_in_gap > 0) {
    battleQuestions.push({
      course_code: input.courseCode,
      logical_question_key: `${keyBase}-bgap`,
      pool: "battle",
      usage: ["battle"],
      difficulty: "beginner",
      prompt: "Fill in the blank: The main topic of this upload is _____.",
      explanation: summary,
      source_reference: learningQ.source_reference,
      answer_format: "fill_in_gap",
      battle_seconds: 12,
      battle_reading_seconds: 4,
      gaps: [{ index: 0, accepted_answers: [title, title.toLowerCase()] }],
    });
  }
  if (input.battleMix.standard > 0) {
    battleQuestions.push({
      course_code: input.courseCode,
      logical_question_key: `${keyBase}-bstd`,
      pool: "battle",
      usage: ["battle"],
      difficulty: "beginner",
      prompt: "What should you do after studying this upload?",
      options: [
        { label: "A", body: "Explain the idea in your own words" },
        { label: "B", body: "Skip all practice" },
        { label: "C", body: "Ignore the source" },
        { label: "D", body: "Publish without review" },
      ],
      correct_option: "A",
      explanation: summary,
      source_reference: learningQ.source_reference,
      answer_format: "standard",
      battle_seconds: 8,
    });
  }
  return {
    title,
    objective: "Explain this concept in your own words and apply it to a new example.",
    module_title: input.moduleTitle,
    blocks,
    flashcards: defaultFlashcards(title, "Explain this concept in your own words and apply it to a new example.", summary),
    learning_questions: [learningQ],
    battle_questions: battleQuestions,
  };
}
