# Mastery XP v2

Apply migrations through `20261014000100_mastery_xp.sql` to a fresh database before running seed.sql.
The migration refuses existing nonzero ledger awards. Obtain an explicit balance migration decision for an existing installation; do not delete or reset the ledger to bypass it. No retrospective awards are generated.

Existing lesson-linked `review` assessments serve as topic knowledge checks. Plain lesson completion records progress only. Multiple checks for one lesson share a 20 XP allowance. Practice and mock allowances use stable assessment IDs across versions. Only submitted attempts qualify; auto-expired attempts retain results but earn no XP.

Scheduled reviews use `start_topic_review_v1(lesson_id, stage, request_key)` and the existing attempt player. They prefer unseen logical questions within the published assessment pool, falling back to previously seen questions if necessary. At least the configured question count must be published. Stages are due 1, 7, and 30 elapsed days from first mastery, not from previous review completion. A missed review remains available; stages cannot be skipped.

`get_xp_progress_v1()` returns personal levels, badges, available reviews, and the most recent 50 ledger entries. Review grants and best-score grants share a per-user transaction lock. Battle finalization locks both users in UUID order, counts every completed match, and awards 2 XP per correct answer plus 5 for a win or 2 for a draw for the first 10 matches/day and first 2/opponent/day. The day is calculated at finalization in Africa/Lagos. Cancelled and forfeited battles do not qualify. A disconnection does not cancel a match; completed disconnected matches are graded normally.

XP is never spent, reset, or used to gate content. Global and faculty XP leaderboards are available to signed-in students, with profile visibility controls. Existing administrator correction RPCs retain append-only reasoned compensation history; corrections do not reopen previously earned best-score or review allowances.

Validation: run workspace typechecks and lint, then database pgTAP tests against a disposable local Supabase database. The existing security, assessment, battle, and admin tests now assert the v2 rules. Database assertions were also exercised in isolated PostgreSQL (PGlite) with auth/realtime stubs; real Supabase Cron, multi-session concurrency, and authenticated browser-to-hosted-database integration still require staging validation. The local frontend currently points to a hosted Supabase project; this change does not apply the migration to that project.

## Welcome XP and engagement

Migration `20261015000100_welcome_xp_leaderboards.sql` adds a one-time 10 XP signup award for accounts created after that migration. It grants no retroactive awards. The profile-insert trigger creates the balance and ledger award in the same transaction; `signup:welcome` is unique per account, so retries cannot duplicate it. Welcome XP counts toward lifetime levels and rankings but not daily learning XP or badges. New learners see a welcome message and a direct leaderboard link on their dashboard. Existing mastery XP, reviews, and battle limits are unchanged. Ranking visibility can be turned off in Profile. This supersedes the original zero-start and disabled-leaderboard defaults.
