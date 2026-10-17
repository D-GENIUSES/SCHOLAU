-- First lesson celebration is a server fact; repeated completions never replay it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into auth.users(id,email,raw_user_meta_data)
values ('ae000000-0000-4000-8000-000000000020','first-lesson-regression@test.local','{"display_name":"First lesson regression"}');
insert into public.enrollments(user_id,offering_id)
values ('ae000000-0000-4000-8000-000000000020','20000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','ae000000-0000-4000-8000-000000000020',true);
set local role authenticated;
select set_config('test.first_completion', public.complete_lesson_v1('23000000-0000-4000-8000-000000000001',gen_random_uuid())::text,true);
select is(current_setting('test.first_completion')::jsonb->>'first_lesson_completed','true','first lesson triggers celebration');
select is(current_setting('test.first_completion')::jsonb#>>'{streak,current}','1','first lesson starts a one-day streak');
select is(current_setting('test.first_completion')::jsonb->>'xp_awarded','0','reading does not award knowledge-check XP');
select set_config('test.repeat_completion', public.complete_lesson_v1('23000000-0000-4000-8000-000000000001',gen_random_uuid())::text,true);
select is(current_setting('test.repeat_completion')::jsonb->>'first_lesson_completed','false','repeated completion does not celebrate');
select set_config('test.second_completion', public.complete_lesson_v1('23000000-0000-4000-8000-000000000002',gen_random_uuid())::text,true);
select is(current_setting('test.second_completion')::jsonb->>'first_lesson_completed','false','second lesson does not celebrate');
select is(current_setting('test.second_completion')::jsonb#>>'{streak,current}','1','another lesson today does not add a streak day');
select * from finish();
rollback;
