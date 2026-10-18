# Lecturer registration and approval

## Entry points

- `/sign-up`: Student or lecturer application choice.
- `/sign-up?role=student`: Existing student registration form, fields and welcome XP behavior.
- `/sign-up?role=lecturer`: Lecturer application; availability is checked against the database feature flag before calling Auth.
- `/verify?kind=lecturer`: Email confirmation instructions distinguish verification from administrative approval.
- `/auth/continue`: Post-login destination resolved from fresh database roles.
- `/lecturer/application`: Owner-only application status, applicant feedback, history and requested corrections.
- `/lecturer`: Approved lecturer workspace showing assigned course offerings, or a no-assignment state.
- `/admin/lecturer-applications`: Protected application queue, verification details, review decisions, private notes and teaching assignments.

## State and permissions

New lecturer signups create an Auth account, a base profile with immutable registration_kind `lecturer_applicant`, and exactly one pending application atomically through the existing Auth insert trigger. The application remains pending until reviewed; email verification is a separate property read from Auth, never a client claim.

Pending, changes-requested and rejected applicants receive neither student nor lecturer roles, student enrollments, welcome XP, nor a public student leaderboard entry. Choosing a role in metadata cannot grant privileges. Existing users are not reclassified and no XP or enrollment backfill is performed.

Only an administrator can approve, request changes or reject a pending application. Approval requires confirmed email; decision, lecturer role, optional assignments, notification, review history and audit record commit in one transaction. Published, valid offerings are checked on the server. Lecturers may be approved with no courses and assigned courses later.

Changes and rejection require an applicant-visible reason. Only changes-requested applications can be edited and resubmitted by their owner. Rejected applications are read-only in this version. Request keys and revisions protect against retries and concurrent review; callers must refresh stale records. Internal notes exist only in the private review table and are omitted from applicant RPC responses.

The application and assignment tables expose no direct client reads or writes. RPCs verify ownership, administrative roles or approved lecturer status on every request. Student academic-profile assignment is blocked for lecturer accounts at database level. All new functions pin search_path and have explicit execute grants. The existing anonymous-RPC prohibition is preserved; the public readiness check uses the already-readable app_config table.

## Database deployment

Migration: `20261016000200_lecturer_registration.sql`. It depends on the existing welcome-XP and account-erasure migrations. Apply it before enabling new lecturer registration in the frontend. It merges `lecturer_applications: true` into the web app_config feature flags, preserving other flags and maintenance settings.

The deployment wrapper in the working task applies only this migration in one transaction with a lock timeout and records its source in migration history. It refuses reapplication. No database reset, blanket migration push or seed is required.

To temporarily stop the application form accepting new lecturer signups, set the web `lecturer_applications` feature flag to false. Do not drop application tables or reverse role changes to undo a UI rollout. Existing student registration does not depend on this flag. Avoid a destructive down migration after real applications exist.

Application, private review and assignment records participate in existing account deletion through cascading owner references; reviewer and assigner references are nulled. No manual account-erasure procedure needs to change.

## Notifications and operational boundaries

Supabase Auth sends verification messages through the project's existing email configuration. The application uses existing in-app notifications for review decisions and updates status when the applicant signs in or refreshes. This change does not configure a separate email provider or promise approval emails or review turnaround times.

Passwords are handled only by Supabase Auth. Do not place passwords or application notes in analytics, URLs or audit metadata. No identity-document upload is requested; the institutional-profile URL is optional and limited to https links.

Existing student-versus-student battles remain separate. The richer lecturer teaching/challenge screens remain in the visual prototype; this registration change connects account approval and actual assigned-course visibility, not the entire challenge backend.

## Verification

The workspace contains the regression runner and browser tests. Database regression runs all migrations and the existing security, identity, content, assessments, XP, battles, curriculum and erasure tests, plus lecturer application scenarios in an isolated PGlite PostgreSQL runtime.

Browser contract tests against the actual Next.js app intercept test signup responses so no live users or emails are created. They verify account choices, fail-closed readiness, lecturer metadata, unchanged student signup metadata, lecturer-specific verification copy, protected routes and mobile layouts. The prototype has additional full application/correction/approval/rejection tests and retains its original challenge-flow regression suite.

No feature can be marked remotely active based on local checks alone: verify the registered migration, feature flag and remote RPC grants after deployment.
