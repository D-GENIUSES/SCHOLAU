-- Fill-in-gap questions store answers in gap_answers; no correct_option_id.

alter table private.question_answer_keys alter column correct_option_id drop not null;
