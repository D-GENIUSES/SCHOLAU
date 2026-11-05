begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select set_config('t.day',(now() at time zone 'UTC')::date::text,true);
-- Isolate one recipient while preserving all changes within this transaction.
insert into private.notification_preferences(user_id,academic) select id,false from public.profiles on conflict(user_id) do update set academic=false;
select set_config('t.student', '90000000-0000-4000-8000-000000000001', true);

delete from private.daily_question_history where user_id=current_setting('t.student')::uuid;
delete from public.notifications where user_id=current_setting('t.student')::uuid and kind='daily_questions';
insert into private.notification_preferences(user_id, timezone, academic)
values (current_setting('t.student')::uuid, 'UTC', true)
on conflict (user_id) do update set timezone = excluded.timezone, academic = excluded.academic;

select is(
  private.prepare_daily_questions((current_setting('t.day')||' 09:00:00+00')::timestamptz),
  1,
  'morning slot creates one daily question notification'
);

select is(
  (select count(*)::int from public.notifications
   where user_id = current_setting('t.student')::uuid
     and kind = 'daily_questions'
     and event_key = 'daily_questions:' || current_setting('t.student') || ':'||current_setting('t.day')||':0'),
  1,
  'slot is idempotent within the same window'
);

select ok(
  (select jsonb_array_length(context->'question_ids') between 1 and 3 from public.notifications
   where user_id = current_setting('t.student')::uuid
     and event_key = 'daily_questions:' || current_setting('t.student') || ':'||current_setting('t.day')||':0'),
  'each notification carries up to three fresh question prompts'
);

select is(
  private.prepare_daily_questions((current_setting('t.day')||' 09:30:00+00')::timestamptz),
  0,
  'repeat worker pass does not duplicate the morning slot'
);

select is(
  private.prepare_daily_questions((current_setting('t.day')||' 13:00:00+00')::timestamptz),
  1,
  'afternoon slot delivers a separate question'
);

select is(
  (select count(*)::int from public.notifications
   where user_id = current_setting('t.student')::uuid
     and kind = 'daily_questions'
     and context->>'date' = current_setting('t.day')),
  2,
  'two slots yield two distinct inbox rows'
);

select ok(
  (select count(distinct coalesce(context->>'question_version_id', context->'question_ids'->>0)) = 2
   from public.notifications
   where user_id = current_setting('t.student')::uuid
     and kind = 'daily_questions'
     and context->>'date' = current_setting('t.day')),
  'same-day slots do not reuse the same question'
);

select ok(
  (select private.push_relevant(n)
  from public.notifications n
  where n.user_id = current_setting('t.student')::uuid
    and n.kind = 'daily_questions'
    and n.event_key = 'daily_questions:' || current_setting('t.student') || ':'||current_setting('t.day')||':0'),
  'eligible daily question remains push-relevant'
);

select is((select count(distinct q.id)::integer from public.notifications n cross join lateral jsonb_array_elements_text(n.context->'question_ids') q(id) where n.user_id=current_setting('t.student')::uuid and n.kind='daily_questions'),(select sum(jsonb_array_length(context->'question_ids'))::integer from public.notifications where user_id=current_setting('t.student')::uuid and kind='daily_questions'),'all questions are distinct across same-day slots');
select * from finish();
rollback;
