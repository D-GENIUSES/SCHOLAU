-- Run against an installed catalogue with an enrolled account and at least 24 accessible learning prompts. All changes roll back; no notifications are sent.
begin;
create temp table test_daily_user(user_id uuid);
insert into test_daily_user
select e.user_id from public.enrollments e join public.profiles p on p.id=e.user_id and p.deactivated_at is null
join public.course_offerings o on o.id=e.offering_id and o.status='published'
join public.questions q on q.course_id=o.course_id and q.pool='learning'
join public.question_versions v on v.question_id=q.id and v.status='published'
join public.assessment_questions aq on aq.question_version_id=v.id
join public.assessment_versions av on av.id=aq.assessment_version_id and av.status='published'
where e.ended_at is null group by e.user_id having count(distinct v.prompt)>=24 order by count(distinct v.prompt) desc limit 1;
do $$ begin if not exists(select 1 from test_daily_user) then raise exception 'No sufficiently populated regression account'; end if; end $$;
insert into private.notification_preferences(user_id,academic,timezone) select user_id,true,'Africa/Lagos' from test_daily_user
on conflict(user_id) do update set academic=true,timezone='Africa/Lagos';
-- Restrict only this transaction's scheduler to the regression account.
do $scope$ declare definition text; begin
 definition:=pg_get_functiondef('private.prepare_daily_questions(timestamptz)'::regprocedure);
 if strpos(definition,'from public.profiles u left join')=0 then raise exception 'Scheduler shape changed; update regression scope'; end if;
 execute replace(definition,'from public.profiles u left join','from (select * from public.profiles where id=(select user_id from pg_temp.test_daily_user)) u left join');
end $scope$;
delete from private.daily_question_history where user_id=(select user_id from test_daily_user);
create function pg_temp.assert_daily(v boolean,label text) returns void language plpgsql as $$ begin if v is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
select pg_temp.assert_daily(private.prepare_daily_questions(((current_date+100)+time '07:59') at time zone 'Africa/Lagos')=0,'no early alert');
do $$ declare d int; h int; total int; replay int; begin
 for d in 100..101 loop
  foreach h in array array[8,12,16] loop
   total:=private.prepare_daily_questions(((current_date+d)+make_time(h,0,0)) at time zone 'Africa/Lagos');
   replay:=private.prepare_daily_questions(((current_date+d)+make_time(h,0,0)) at time zone 'Africa/Lagos');
   if total<>1 or replay<>0 then raise exception 'Slot/replay failure day % hour %',d,h; end if;
  end loop;
 end loop;
end $$;
select pg_temp.assert_daily((select count(*)=18 from private.daily_question_history where user_id=(select user_id from test_daily_user)),'18 different questions across six slots/two days');
select pg_temp.assert_daily((select count(*)=6 from public.notifications where user_id=(select user_id from test_daily_user) and kind='daily_questions' and (context->>'date')::date between current_date+100 and current_date+101),'exactly three daily alerts');
select pg_temp.assert_daily(not has_table_privilege('authenticated','private.daily_question_history','select'),'history stays private');
select pg_temp.assert_daily(not has_function_privilege('authenticated','private.prepare_daily_questions(timestamptz)','execute'),'scheduler stays private');
-- A question's stable identity remains blocked across later slots/days.
create temp table test_sent_questions as select question_id from private.daily_question_history where user_id=(select user_id from test_daily_user);
select private.prepare_daily_questions(((current_date+102)+time '08:00') at time zone 'Africa/Lagos');
select pg_temp.assert_daily(not exists(select 1 from public.notifications n cross join lateral jsonb_array_elements_text(n.context->'question_ids') i(id) join public.question_versions v on v.id::text=i.id where n.user_id=(select user_id from test_daily_user) and n.context->>'date'=(current_date+102)::text and v.question_id in(select question_id from test_sent_questions)),'stable question identity remains blocked');
-- Exhaust every remaining eligible question; never refill with recycled questions.
insert into private.daily_question_history(user_id,question_id,prompt_fingerprint)
select distinct e.user_id,q.id,md5(regexp_replace(lower(btrim(v.prompt)),'[[:space:][:punct:]]+','','g'))
from public.enrollments e join public.course_offerings o on o.id=e.offering_id
join public.questions q on q.course_id=o.course_id join public.question_versions v on v.question_id=q.id and v.status='published'
where e.user_id=(select user_id from test_daily_user) and e.ended_at is null on conflict do nothing;
select pg_temp.assert_daily(private.prepare_daily_questions(((current_date+102)+time '12:00') at time zone 'Africa/Lagos')=0,'exhausted pool is silent');
select pg_temp.assert_daily(private.prepare_daily_questions(((current_date+102)+time '20:00') at time zone 'Africa/Lagos')=0,'no fourth slot');
-- A final one-question pool produces a single fresh item, then remains silent.
create temp table test_last_question as
select h.question_id from private.daily_question_history h
join public.questions q on q.id=h.question_id and q.pool='learning'
join public.question_versions v on v.question_id=q.id and v.status='published'
where h.user_id=(select user_id from test_daily_user)
and exists(select 1 from public.assessment_questions aq join public.assessment_versions av on av.id=aq.assessment_version_id and av.status='published' where aq.question_version_id=v.id)
order by h.first_sent_at,h.question_id limit 1;
delete from private.daily_question_history where user_id=(select user_id from test_daily_user) and question_id in(select question_id from test_last_question);
select pg_temp.assert_daily(private.prepare_daily_questions(((current_date+103)+time '08:00') at time zone 'Africa/Lagos')=1,'one fresh item remains');
select pg_temp.assert_daily((select jsonb_array_length(context->'question_ids')=1 from public.notifications where user_id=(select user_id from test_daily_user) and context->>'date'=(current_date+103)::text and context->>'slot'='0'),'small pool is not padded with repeats');
select pg_temp.assert_daily(private.prepare_daily_questions(((current_date+103)+time '12:00') at time zone 'Africa/Lagos')=0,'small pool exhaustion stays silent');
select jsonb_build_object('passed' ,true,'slots_checked',6,'fresh_question_count',18,'replay','passed','stable_identity','passed','exhaustion','passed','permissions','passed','side_effects','rolled back') report;

rollback;
