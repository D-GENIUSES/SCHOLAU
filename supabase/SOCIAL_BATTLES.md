# Friends and scoped battles

Migration: `20261017000900_social_scoped_battles.sql`.

Students manage friends and their username in the Battles page. Requests must
be accepted before sending a directed invitation. Either user can remove a
friendship; blocking prevents requests and accepting invitations between them.
Search returns names and handles, never email addresses. All social writes go
through authenticated RPCs; tables have RLS and no client write grants.

Direct challenges support 1–3 shared course offerings and 5–30 total questions.
The split is balanced in selection order: for 10 questions across three courses,
the allocation is 4/3/3. The server checks current enrollment for both players,
checks content when creating the invitation and checks it again at readiness.
The invited player sees course codes and question count before accepting.
Shareable links enforce enrollment on acceptance. Random matchmaking remains
a five-question, single-course quick match.

## Future question imports

Use Admin > Import with the existing JSON import and review/publish workflow.
Battle rows require `pool: "battle"`, `usage: ["battle"]`, exactly four options
and one `correct_option` matching an option label. Existing source-reference,
explanation and admin review requirements still apply.

Additional fields:

- `answer_format`: `standard` (default) or `worked_solution`.
- `options[].steps`: up to six short calculation steps (240 characters each).
  Required on every worked-solution option; put the final answer in `body`.
- `battle_seconds`: optional 10, 12 or 15. Without an override, total prompt,
  option and step length determines a suggested duration. Worked solutions
  receive at least 12 seconds automatically. A reviewer should explicitly
  choose 15 seconds for questions needing extra reasoning.

Example structure (illustrative only; no production question is created):

```json
{
  "course_code": "YOUR_COURSE",
  "logical_question_key": "linear-equation-001",
  "pool": "battle",
  "usage": ["battle"],
  "difficulty": "beginner",
  "prompt": "Solve 2x + 6 = 18. Choose the correct working.",
  "answer_format": "worked_solution",
  "battle_seconds": 15,
  "options": [
    {"label":"A","steps":["2x = 18 − 6","x = 12 ÷ 2"],"body":"x = 6"},
    {"label":"B","steps":["x = 18 ÷ 2 − 6","x = 9 − 6"],"body":"x = 3"},
    {"label":"C","steps":["2x = 18 + 6","x = 24 ÷ 2"],"body":"x = 12"},
    {"label":"D","steps":["x = 18 − 6 ÷ 2","x = 18 − 3"],"body":"x = 15"}
  ],
  "correct_option":"A",
  "explanation":"Subtract 6 from both sides, then divide both sides by 2.",
  "source_reference":"Replace with the reviewed course source"
}
```

The administrator reviews the plausibility of distractors, mathematical
correctness, readability and time required. Automatic length estimation does
not judge cognitive difficulty. Long solutions should be simplified for battle
or reserved for practice if they cannot be read comfortably in 15 seconds.

## Timing and redaction

All rounds are scheduled by the server with each question's duration. Both
players share the same prompts, shuffled options and deadlines. Published
versions are immutable; the battle's selected versions and deadlines persist
through reconnection. Payloads expose only the current question and its steps;
future questions and answer keys remain hidden.

No demo questions/users are deployed. Local tests use transaction-isolated
fixtures. A production match still requires enough published content.
