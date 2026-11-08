# Lecturer course quizzes

Approved lecturers open **My courses → Quizzes**. Enrolled students open **Study → Course → Assessments → Class quizzes** or notifications linking to `/course-quizzes/{id}`.

Each quiz belongs to one assigned course offering. The editor supports manual multiple-choice questions (2–6 options) and optional PDF/Word import via Gemini. Students confirm matriculation number plus read-only name and department before starting.

## Scheduling

- **Opens** and **closes** are required at publish time (local editor timezone, stored UTC).
- **Duration per attempt** (1–180 minutes) is required. Each attempt expires at `min(started_at + duration, closes_at)`.
- Question and option order are **shuffled per attempt** server-side.

## Attempts

- Default **one attempt**; lecturers may allow up to three.
- Answers auto-save; students submit manually or expire at deadline.
- **No XP** is awarded. Lecturers download **CSV** results and browse the roster.

## RPCs

`list_course_quizzes_v1`, `save_lecturer_quiz_v1`, `publish_lecturer_quiz_v1`, `cancel_lecturer_quiz_draft_v1`, `get_course_quiz_v1`, `start_lecturer_quiz_attempt_v1`, `save_lecturer_quiz_answer_v1`, `submit_lecturer_quiz_attempt_v1`, `lecturer_quiz_roster_v1`, `export_lecturer_quiz_results_v1`, `start_lecturer_quiz_import_v1`, `get_lecturer_quiz_import_v1`.

Apply migration `20261108000100_lecturer_course_quizzes.sql` before deploying the web app.

## Verification

- `node scripts/test-lecturer-quizzes-database.mjs` — authz, shuffle, scoring, matric snapshot, export.
- `node scripts/test-lecturer-quizzes-browser.mjs` — editor publish flow and student intake (when Playwright runtime is available).
