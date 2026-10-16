# Adeleke University curriculum

Source: the three user-provided screenshots saved in `sources/`. Academic session 2026/2027 was confirmed by the user. The transcript is in `adeleke-200-first-semester.json`.

11 distinct courses are shared across 28 programme requirements: Computer Science has 10 courses/21 units; Cybersecurity 9 courses/19 units; Software Engineering 9 courses/19 units. Units and status codes C/R are copied exactly; they have not been reinterpreted. The programme grouping uses Computing Sciences for onboarding.

Migration `20261015000200_adeleke_course_curriculum.sql` creates the university hierarchy, a 200 Level option, the 2026/2027 academic session, its First semester, reusable curriculum requirements, and published course offerings. No calendar dates were provided; academic period dates may remain null until supplied. Both dates must be entered together and the existing end-after-start validation remains in effect.

Catalog and enrollment use the student's canonical university, programme, level, and semester. Shared course records retain shared lesson/question content; their offerings remain programme-specific. Courses may be selected while lesson counts are zero; the UI shows Content coming soon and existing published-content checks keep quizzes and battles unavailable. No lessons, questions, or XP awards were invented for these course titles.

When a future active first semester is added for this university, the semester trigger creates corresponding offerings from the active curriculum. An inactive semester creates none. Review the curriculum before opening a new session and deactivate obsolete requirement rows first. `private.materialize_curriculum(semester_id)` can resync units/statuses safely; it preserves explicitly retired or draft existing offerings. Course lists for another university, level, or semester are not generated.

The migration is independent of the XP migrations and can be deployed alone. Test `09_curriculum.test.sql` covers source totals, profile matching, enrollment, access controls, duplicate protection, and future-session behavior.
