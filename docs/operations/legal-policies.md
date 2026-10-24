# Policy drafts and registration safeguards

Implemented in the `lesson-release` checkout on `codex/publish-course-lessons`, the latest release copy in this workspace. The desktop source and other staging copies were not overwritten. No deployment or remote migration was performed.

## Draft status

`/privacy` and `/terms` are public, printable draft pages, excluded from indexing, with no effective date. Both are linked from registration, settings, the account footer and the learning shell footer. Legal pages permit browser zoom. Text is in `apps/web/lib/policy-content.ts` and the version is in `apps/web/lib/legal.ts`.

Before publication, supply the operator name, Nigerian postal address and working privacy/support email; verify processor locations, transfer safeguards, retention and backup handling; and approve the final content. Replace the draft banner, registration link labels and closed-path wording together, add the approved effective date, and issue matching final policy versions in the web code and database. Do not simply toggle a database flag while the pages still say draft.

Current analytics evidence: `Providers` supplies no adapter to `AnalyticsProvider`, which defaults to `noopAnalytics`. The policy distinguishes these discarded product events from operational records and hosting logs. Account deletion remains support-assisted; stored files require the provider Storage API in addition to database erasure.

## Installation and compatibility

Apply `20261020000300_legal_registration.sql` to a development/staging Supabase instance before releasing the matching forms. Missing or mismatched registration status causes the forms to fail closed. The migration is additive and does not change existing accounts or invent historical acceptance.

New Auth accounts must supply `terms_accepted: true`, matching `terms_version` and `privacy_version`, and `age_declaration: adult | under18` in user metadata. The Auth insert trigger checks these inside the signup transaction; acceptance is recorded with a server timestamp in a private table. Mutable Auth metadata cannot rewrite the recorded acceptance. An age declaration is self-reported, not identity-based age verification.

Migration `20261020001000_pending_provider_registration.sql` adds a pending registration flow for new Google identities and administrator-provisioned accounts. These identities complete the age and acceptance form once inside the application. Application RPCs, protected content and realtime channels are blocked until completion; pending identities are hidden from the leaderboard. Consent is recorded only when the account owner submits the form. Existing accounts do not acquire a new acceptance requirement. Email registration retains its original atomic validation. Coordinate the migration and web release so the completion page is available before enabling the pending flow.

## Manual guardian process

The default gate is closed. No under-18 applicant intake endpoint is enabled. Once the final policies, contacts, verification, retention and safeguarding procedures are operational, an operator with direct database authority can configure `private.legal_settings`: final versions, `published`, `guardian_enabled`, real operator details and email, and `operations_verified`. Draft versions or incomplete details continue to block activation. These settings have no client write permissions.

Support uses an authenticated active-administrator session for these RPCs; no service-role key belongs in a browser:

- `admin_create_guardian_request_v1(applicant_email, guardian_name, guardian_email, relationship, expires_at)` records a pending request and returns its UUID. Expiry is chosen under the approved operational procedure, not a promised retention period.
- `admin_review_guardian_request_v1(request_id, approve, consent_received_at, verification_note, authority_verified)` records consent receipt, reviewer, server verification time and decision. Verify identity, guardian authority, university eligibility and age-appropriate use outside the signup form. Record a minimal reference/summary; do not copy identity documents into notes. Review requires current policy versions and an operational gate.
- `admin_list_guardian_requests_v1()` returns the latest 100 records only to active administrators. This is a manual support RPC workflow, not a new admin dashboard.

Only send the returned UUID to the applicant after approval. The code is a secret bound to their email and is consumed atomically by signup. Missing, pending, rejected, expired, wrong-email, outdated-version and reused codes cannot create an account. A failure rolls back the Auth user, profile and consent consumption.

For withdrawal, immediately restrict an active child account using existing administrative controls, then process the request and erasure as appropriate. Pending/unlinked request deletion follows the approved retention procedure. Auth account erasure removes linked acceptance and guardian records and other requests for the same applicant email. Reviewer references are nulled when the reviewing administrator is erased.

## Verification

- `cd apps/web; node tests/legal-registration.cjs`: client validation cases.
- `node scripts/test-legal-database.mjs`: actual migration in isolated PGlite PostgreSQL with minimal Auth/profile/admin stand-ins. Install `@electric-sql/pglite` in an external test runtime and set `LEGAL_TEST_RUNTIME` to its directory, or use the sibling `.legal-test-runtime` prepared locally.
- `node scripts/test-legal-browser.mjs`: local app plus mocked Supabase responses, desktop/mobile pages, print PDFs and student/lecturer signup payloads. Uses Playwright from the same test runtime and installed Edge; `LEGAL_TEST_ORIGIN` defaults to port 3138. It never calls a live database. Output goes to ignored `.legal-verification/`.
- `supabase test db`: includes `28_legal_registration.test.sql` against the complete schema. Existing non-legal SQL tests include a transaction-scoped synthetic consent helper for their generated adult fixtures; the legal test deliberately does not include it. Fixture consent must never be installed as a production trigger.

Full local Supabase integration requires Docker, which was not running in this environment. Isolated trigger tests and mocked browser checks do not replace the staging Auth/GoTrue integration check before release. Keep both policies and the guardian gate in draft/closed state until the publication prerequisites are complete.

### Local results — 19 October 2026

- TypeScript check passed, including generated route types.
- Production build passed (`next build --webpack`), including static generation of `/privacy` and `/terms`. The first sandboxed build hit a filesystem permission error; the approved rerun completed successfully.
- ESLint passed for the changed pages, components, policy helpers, middleware and client regression harness.
- Client policy checks: 12 passed.
- Isolated PostgreSQL migration/trigger checks: 37 passed. The actual migration ran successfully; existing application/Auth helpers were minimal stand-ins.
- Browser checks: 39 passed. Both public pages returned HTTP 200 without authentication at widths 365 and 1440, with no horizontal overflow. Draft metadata, anchor navigation, zoom permission and print layout passed. Both registration forms sent acceptance/version/age metadata; unchecked terms, the closed guardian path and missing status service prevented registration. Supabase network responses were mocked; no real accounts were created.
- Policy screenshots and two print PDFs were generated in `.legal-verification/`; the mobile privacy screenshot was visually reviewed.
- Full Supabase/GoTrue and legacy pgTAP suite: not run because Docker was unavailable. A complete-schema legal regression test and transaction-scoped fixtures are included for that environment.
- No production database migration, publication or deployment performed.
