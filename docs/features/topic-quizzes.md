# Compact course assessments

Home → Open assessments opens `/study/courses/{offeringId}/assessments`.
The page uses the existing app shell, design tokens and controls, with three
compact tabs: Topic quiz, Mock exam and Challenges. Existing lesson topic checks
remain available in a collapsed list, and existing assessment URLs still work.

Personal quizzes combine 1–30 published lesson topics, with 1–100 questions and
at least one question per selected topic. Sampling is randomized and balanced
across topics. The pool includes published, standard four-option learning
questions marked for practice, with answer keys. Advanced questions follow the
existing mastery gate (including the advanced-only topic fallback). Empty topics
show Coming soon. Quizzes are untimed; saving, grading, results and XP reuse the
existing assessment engine. A student can resume one active personal quiz per
course. New quiz on practice results returns to topic selection.

The private RLS-enabled `topic_quiz_banks` registry lazily creates a single draft
practice assessment/version per course as a session anchor. This anchor is not
published content and is excluded from the course assessment catalogue. Only
`start_topic_quiz_v1` starts it; questions are fixed in `attempt_questions`.
`get_topic_quiz_options_v1` returns counts and the current student's active quiz,
without prompts or answer keys. Both RPCs require an authenticated active student
and enrollment in the requested offering. The pool helper has no client grants.

Mocks use published assessments and the existing configurable-attempt RPC, with
up to 50 questions, the configured duration (60 minutes if absent), and a timer
confirmation. Challenges use the existing lecturer publication/participation
workflow and include scheduled, active and finished challenges.

## Release order

1. `supabase/migrations/20261106203528_compact_topic_assessments.sql` was applied
   to production project `gbcegscbkzfxldvdiqdf` on 6 November 2026 at the user's
   request and recorded as version `20261106203528`. It is additive, changes no
   existing question content and requires no data backfill.
2. Commit and push the canonical checkout's `main` with GitHub Desktop. The
   existing Vercel Git integration builds the production app at scholau.com.

The GitHub database workflow tests a disposable database; it does **not** apply
production migrations. This migration is already applied; do not reapply it
manually. No app deployment or Git push was performed during implementation.

## Verification

- `node scripts/test-topic-quizzes-database.mjs`: real SQL, permissions,
  enrollment, invalid/foreign/draft/empty topics, mastery gating, balanced
  sampling, idempotency, active attempts, answer hiding, saving and grading.
- `node scripts/test-topic-quizzes-browser.mjs`: actual React components and API
  client connected to the isolated SQL fixture over HTTP; topic selections,
  count validation, quiz start/resume, mock timer confirmation, lecturer challenge
  listing, keyboard tabs and all three tabs at 320/390/768/1440px.
- The fixture reuses the existing course-challenge PGlite harness. It uses
  `LECTURER_TEST_RUNTIME` or the adjacent `.legal-test-runtime`; browser checks
  require a built web stylesheet and headless Edge. Screenshots are saved under
  ignored `.lecturer-verification/topic-quizzes`.
