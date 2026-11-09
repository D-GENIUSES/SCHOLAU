/** Progress thresholds are cumulative: 100, 300, 600, 1000 XP. */
export function xpProgress(total: number) {
  const xp = Math.max(0, Math.floor(total));
  const level = Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2);
  const current = 50 * level * (level - 1);
  return { level, current, next: 50 * level * (level + 1), earned: xp - current, required: 100 * level };
}

export const ASSESSMENT_XP_COPY = {
  practice: "Earn 2 XP per correct answer and 5 bonus XP for scoring at least 80%.",
  mock: "Earn 3 XP per correct answer and 15 bonus XP for scoring at least 80%.",
};

export const XP_BADGES: Record<string, { title: string; description: string }> = {
  first_steps: { title: "First Steps", description: "Complete a lesson knowledge check." },
  topic_mastered: { title: "Topic Mastered", description: "Score at least 80% on a topic check." },
  perfect_practice: { title: "Perfect Practice", description: "Score 100% on a practice quiz." },
  first_quiz: { title: "Quiz Starter", description: "Submit a practice or topic quiz." },
  quiz_ace: { title: "Quiz Ace", description: "Score at least 80% on a practice or topic quiz." },
  exam_ready: { title: "Exam Ready", description: "Score at least 80% on a mock exam." },
  first_mock: { title: "Mock Exam Starter", description: "Submit a mock exam." },
  perfect_mock: { title: "Mock Exam Champion", description: "Score 100% on a mock exam." },
  long_term_recall: { title: "Long-Term Recall", description: "Complete all three scheduled reviews for a topic." },
};
