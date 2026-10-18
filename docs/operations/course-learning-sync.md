# Source material → explained learning

The initial teaching pack contains five introductory concepts for each of 31
courses: 155 explained lessons, 155 formative checks, 155 learning questions,
155 separate battle questions and 93 course assessments. This is initial concept
coverage, not complete coverage of each syllabus or all 111 source files.

Each lesson has an objective, a plain-language explanation, a worked
illustration, a common mistake, a summary and an interactive check. An incorrect
answer shows an explanation and permits retrying. These checks are visible in
lesson data and award no XP. Scored assessments retain private answer keys.
The course page leads students through lessons rather than a list of PDFs.

## Data flow and safeguards

1. Originals stay in private R2 under content-addressed keys. The builder verifies
   original bytes, the question-bank hash and its extracted-page evidence.
2. `teaching-notes*.txt` supplies authored explanations and examples. Missing
   teaching notes stop generation: the builder never falls back to raw PDF text.
   Excluded personal records, marking guides and executable sources stay excluded.
3. The API validates the administrator and bundle before checking R2 object size
   and SHA-256 metadata. Missing or mismatched objects prevent the course import.
4. Existing import/publish RPCs apply a whole course in one database transaction.
   Stable logical lesson keys retain identities and progress. A changed bundle
   creates new versions; an identical retry creates no duplicates. Synchronizations
   for one course are serialized.
5. Drafts remain hidden. Publication activates lessons, questions and three course
   assessments together. Existing enrollment, scoring and reward rules apply.

The private source catalog also supports an optional authenticated attachment
API. It requires enrollment in the exact published offering before signing a
five-minute R2 link. It is not presented as the main student learning experience.

Synchronization never creates courses, changes enrollments, deletes absent
content or retires unrelated content. Removal remains an explicit retirement
operation. New files and changed hashes need reviewed authoring and a new bundle.
There is no background AI service or scheduled automatic publication.

## Prepare and activate

Deploy `20261018000500_course_material_sync.sql` through the normal migration
process. Earlier hosted versions 00300 and 00400 belong to username/leaderboard
changes. Deploy the web app and shared core together: older clients cannot render
the new `checkpoint` block. Then generate private bundles:

```powershell
python scripts/build-course-material-bundles.py --intake ../materials/computer-science
```

Sign in as an existing administrator and open `/admin/content-sync`. Upload one
JSON from `.content-sync/`, expand the lessons, review their explanations and
checks, validate storage, save drafts and publish the reviewed content. Test the
result with an enrolled student, including wrong-answer feedback and an assessment.

For batch operation, privately set `SCHOLAU_SITE_URL` and a valid existing
administrator's `SCHOLAU_ADMIN_ACCESS_TOKEN`. Never paste tokens into commands,
logs or committed files. Run:

```powershell
node scripts/sync-course-materials.mjs .content-sync validate "COS 101"
node scripts/sync-course-materials.mjs .content-sync drafts "COS 101"
node scripts/sync-course-materials.mjs .content-sync publish "COS 101"
```

Omit the course argument for every manifest entry. The runner verifies bundle
hashes, records results privately and stops on failure. Completed courses can be
retried. It does not create users, impersonate reviewers or use service-role keys.

## Evidence and rollout state

Local database tests load real migrations and fixtures, publish all 31 bundles
and replay them. They cover permissions, hidden drafts, failed-validation
isolation, version updates, enrollment, assessment startup and rejection of
malformed checkpoints or raw-extract-only lessons. API tests cover the route
boundaries and storage failures. Browser tests use production React components
with a local HTTP fixture; they do not claim hosted end-to-end publication.

The initial hosted preflight found zero questions from this bank and no sync RPC.
On 18 October 2026, the course synchronization migration was installed and its
RPC was verified on the hosted database. Read-only R2 verification confirmed all
45 referenced original objects matched their sizes and recorded hashes.
Publishing the prepared bundles requires an authenticated administrator. The
source files do not need to be uploaded again. Local publication tests do not
publish hosted content.

Run API tests from `apps/web`: `node tests/course-material-routes.cjs`.
Run database/browser tests from the repository root after generating bundles:
`node scripts/test-course-materials.mjs` and
`node scripts/test-course-materials-browser.mjs`.
The database test uses the existing sibling `.xp-test-runtime` PGlite install.
The browser test uses bundled Playwright (or `SCHOLAU_BROWSER_RUNTIME`) and a
built web stylesheet. Production compilation passed using `next build --webpack`;
Turbopack encountered a CSS worker process failure in this environment.
