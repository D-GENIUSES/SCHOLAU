# Course challenges

Approved lecturers open **My courses → Challenges** or **Students**. Students open **Study → Course → Course challenges**; publication also creates an internal notification.

Each challenge belongs to one assigned course offering (including its academic period and semester). The draft editor accepts 1–100 four-option questions from the published standard multiple-choice course bank, lecturer-authored questions, or both. Drafts may temporarily contain no questions. Titles, instructions, duration and scheduled start persist. Duration defaults to 15 minutes (range 1–180). Schedule inputs use the browser's displayed time zone and are stored as UTC timestamps.

Publication freezes a snapshot of question content and keys and notifies currently enrolled students. Questions authored here do not modify the shared bank. Published challenges cannot be edited; unfinished challenges and drafts can be cancelled. Immediate and scheduled challenges share the same server-controlled start/deadline. No browser or scheduled job must stay open for the deadline to take effect.

Students have one attempt, may enter late, navigate questions, save answers automatically, and submit once. Revisions prevent another tab from silently overwriting answers. Failed saves remain visibly pending and block submission until retried or reloaded. Only answers received before the server deadline count. A lost network connection does not pause the challenge.

Results are hidden until the common deadline. Reading an expired attempt finalizes that attempt; reading the roster finalizes all remaining attempts. Expired attempts receive the common closing timestamp. Scores count correct answers; wrong/unanswered questions earn zero. Ranking uses score descending then elapsed time from the common start ascending. Exact ties share rank; nonparticipants have no rank. No XP or official grades are awarded. Current teachers see student answers after closing. Hidden leaderboard identities appear as stable participant aliases to classmates; no other student's UUID is included. Historical attempts survive ended enrollment.

## Security and interfaces

Two private, RLS-enabled, RPC-only tables store challenges (including question snapshots and keys) and attempts. Browser roles cannot read or mutate them directly. All ten public RPCs require an authenticated active user and validate teaching assignment, enrollment or historical participation as appropriate. Answer, submit, cancellation and publication use row locks; attempt revisions reject stale writes. Bank queries canonicalize selected version IDs and reject other-course, unpublished, nonstandard or duplicate questions. Correct answers are stripped from active student responses.

RPCs: `list_course_challenges_v1`, `challenge_question_bank_v1`, `save_course_challenge_v1`, `publish_course_challenge_v1`, `cancel_course_challenge_v1`, `get_course_challenge_v1`, `join_course_challenge_v1`, `answer_course_challenge_v1`, `submit_course_challenge_v1`, `course_challenge_roster_v1`. Shared types live in `@scholau/core`; the web API uses the current user's Supabase session. Lists/bank/rosters are paginated in groups of 20. Management is available to currently assigned lecturers, including co-teachers.

## Verification and rollout

- `node scripts/test-course-challenges-database.mjs`: isolated PGlite database with actual foundational migrations, assignment migration, exact answer-format column DDL and the new migration. Checks authorization, private grants, bank canonicalization, frozen snapshots, timings, idempotency, revisions, ranking, history and nonparticipants. This focused harness avoids an unrelated historical duplicate-function migration in the full database suite.
- `node scripts/test-course-challenges-browser.mjs`: actual React components and web API against those SQL RPCs using local HTTP and headless Edge. Covers author → save/reopen → publish → two students → retry/reconnect/stale-tab handling → close → results; scheduling/cancellation; keyboard radio input; 320/390/768/1440px layouts. Only transport/auth are substituted for isolated fixture identities. It never creates production accounts.
- Both scripts use `LECTURER_TEST_RUNTIME` or the adjacent `.legal-test-runtime` for PGlite/Playwright. Browser script requires a completed web build for its stylesheet. Screenshots go to ignored `.lecturer-verification/challenges`.
- Apply `20261029001500_course_challenges.sql` before deploying the frontend. This is additive with no backfill. Confirm all ten RPCs are authenticated-only and the tables remain private. A frontend rollback can leave the additive database objects in place; retain attempts and challenge records.
