process.env.GEMINI_MODEL = process.env.FORCE_GEMINI_MODEL || process.env.GEMINI_MODEL;
await import("../../scripts/generate-100level-topic-quizzes.mjs");
