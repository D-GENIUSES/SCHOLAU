-- Fill-in-gap battle questions publish without MCQ options.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('role', 'authenticated', true);
end $$;

select set_config('t.admin', '90000000-0000-4000-8000-000000000002', true) is not null as setup;
select pg_temp.login(current_setting('t.admin')::uuid);

select set_config('t.gap_row', $json$[
  {"course_code":"CYB101-FIXTURE","logical_question_key":"GAP-PUB-1","pool":"battle","usage":["battle"],
   "answer_format":"fill_in_gap","difficulty":"beginner","prompt":"The capital of Nigeria is ____.",
   "gaps":[{"accepted_answers":["Abuja","Federal Capital Territory"]}],
   "explanation":"Abuja has been the capital since 1991.","source_reference":"Fixture fill-in-gap"}
]$json$, true) is not null as setup;

select set_config('t.gap_imp', (public.admin_import_questions_v1(current_setting('t.gap_row')::jsonb, false, gen_random_uuid()))::text, true)
  is not null as setup;
select is((current_setting('t.gap_imp')::jsonb ->> 'imported'), 'true', 'fill-in-gap battle question imported');
select set_config('t.gap_vid', current_setting('t.gap_imp')::jsonb -> 'created' -> 0 ->> 'question_version_id', true) is not null as setup;
select is((select count(*)::integer from public.question_options where question_version_id = current_setting('t.gap_vid')::uuid), 0,
  'fill-in-gap has no MCQ options');
select is(
  (public.admin_publish_v1('question_version', current_setting('t.gap_vid')::uuid, gen_random_uuid())) ->> 'status',
  'published',
  'fill-in-gap draft publishes without options'
);

reset role;
select finish();
rollback;
