# Computing Sciences PDF reconciliation

Deployment status: **live and verified on 16 October 2026** in Supabase project `gbcegscbkzfxldvdiqdf`.

Source SHA256: `e67b4be126c0839be5a601ac01330de695df60a17de392801d6c3746156211b3`

20 semester lists; 160 programme requirements; 96 canonical courses.
43 requirements added across six 400 Level semester lists. Existing 117 requirements retained and source references reconciled.

| Programme | Level | Semester | Courses | Required courses | Printed units | Listed units | PDF page |
|---|---:|---:|---:|---:|---:|---:|---:|
| Computer Science | 100 | 1 | 10 | 8 | 19 | 19 | 1 |
| Computer Science | 100 | 2 | 8 | 7 | 17 | 17 | 1 |
| Computer Science | 200 | 1 | 10 | 10 | 21 | 21 | 2 |
| Computer Science | 200 | 2 | 9 | 9 | 19 | 19 | 2 |
| Computer Science | 300 | 1 | 8 | 5 | 18 | 20 | 3 |
| Computer Science | 300 | 2 | 7 | 7 | 18 | 18 | 3 |
| Computer Science | 400 | 1 | 8 | 6 | 18 | 20 | 4 |
| Computer Science | 400 | 2 | 6 | 6 | 17 | 17 | 4 |
| Cybersecurity | 200 | 1 | 9 | 9 | 19 | 19 | 5 |
| Cybersecurity | 200 | 2 | 8 | 8 | 17 | 17 | 5 |
| Cybersecurity | 300 | 1 | 7 | 7 | 16 | 16 | 6 |
| Cybersecurity | 300 | 2 | 7 | 7 | 16 | 16 | 6 |
| Cybersecurity | 400 | 1 | 7 | 7 | 16 | 18 | 7 |
| Cybersecurity | 400 | 2 | 8 | 8 | 16 | 21 | 7 |
| Software Engineering | 200 | 1 | 9 | 9 | 19 | 19 | 8 |
| Software Engineering | 200 | 2 | 10 | 10 | 22 | 22 | 8 |
| Software Engineering | 300 | 1 | 7 | 7 | 18 | 18 | 9 |
| Software Engineering | 300 | 2 | 8 | 8 | 19 | 19 | 9 |
| Software Engineering | 400 | 1 | 6 | 6 | 19 | 16 | 10 |
| Software Engineering | 400 | 2 | 8 | 8 | 17 | 21 | 10 |

## Subsequent first-year update

On 16 October 2026, migration 20261016000300 added the shared first-year list for CYB and SEN following the user’s instruction. This supersedes the pending-first-year statements in this historical PDF reconciliation. See SHARED_FIRST_YEAR.md for provenance and provisional status. Current total: 196 requirements across 24 semester lists, referencing the same 96 canonical courses.

## Source discrepancies and decisions

- Computer Science 300 first semester: 20 listed option units; choose one of CYB 305 and INS 311 for 18 units. Existing elective group retained.
- Computer Science 400 first semester: 20 listed option units; choose one of SEN 401 and IFT 403 for 18 units. SEN 401 retains its printed C status but belongs to the explicit elective group, so neither option is automatically assigned.
- Cybersecurity 400: first semester totals 18 listed units versus 16 printed; second semester totals 21 versus 16. Individual row values retained.
- Software Engineering 400: first semester has 16 unique-course units versus 19 printed (duplicate COS 409 adds 3). COS 409 appears twice with PH 0 and PH 45; one course retained, PH left unknown for a new record, existing PH preserved on replay.
- Software Engineering 400 second semester: 21 listed units versus 17 printed. Individual row values retained.
- No existing canonical codes/titles are overwritten. Source spelling variants remain in source_code/source_title. COS 203 remains mapped to the existing CSC 203 identity.
- Computer Science CYB 305 lecture hours remain unknown. No cross-programme hours inferred.
- 100 Level Cybersecurity and Software Engineering remain pending; the first-year page is kept in the Computer Science sequence.
- Direct-entry GES requirements remain pending a specific list and admission-route data.

## Preservation and rollout

No deletion, curriculum deactivation, enrollment reset, learning content creation or API change. Existing published/draft/retired offering status is preserved by materialization. Required C/R courses, including zero-unit seminars, use the existing assignment triggers. Optional courses remain student choices.

## Validation

Local PostgreSQL compatibility suite: **508 checks passed, zero failed** across 13 regression files. All 20 academic-profile flows pass, and all 160 source rows match their transcribed metadata. Migration replay preserves course IDs, offering statuses, enrollments, lesson progress and assessment attempts. The runner excludes the pg_cron jobs migration because PGlite does not provide pg_cron; this change does not modify jobs. This is not a hosted-database result.

The existing schema-count assertion was updated from 40 to 41 to include the pre-existing battle_integrity_events table. Catalogue assertions now use PDF order and expanded counts.

Live preflight found 117 curriculum requirements and confirmed migration 20261015000400 (automatic assignment) was missing. The existing CLI login successfully deployed that prerequisite and 20261016000100 in a single transaction. No unrelated pending migrations were deployed.

The transaction validated all 20 profile flows and protected pre-existing course identities/titles, offering statuses, active enrollments, lesson progress and assessment attempts with before/after row comparisons. All preservation checks passed before commit.

Post-deployment hosted verification passed independently for all 20 programme/level/semester combinations, all 160 source rows, automatic assignment and assignment replay, elective selection constraints, and empty-course readiness. Migration history records both applied versions. No temporary verification users remain. Final coverage: 81 first-semester offerings and 79 second-semester offerings, referencing 96 canonical courses. No learning content was generated.

100 Level Cybersecurity and Software Engineering remain explicitly unsupported pending confirmation. Handbook discrepancies listed above remain documented; the deployment does not resolve them by inference.
