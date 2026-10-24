begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select set_config('t.student', '90000000-0000-4000-8000-000000000001', true);

insert into private.notification_preferences(user_id, timezone, academic)
values (current_setting('t.student')::uuid, 'UTC', true)
on conflict (user_id) do update set timezone = excluded.timezone, academic = excluded.academic;

select is(
  private.prepare_daily_questions('2026-10-24 09:00:00+00'::timestamptz),
  1,
  'morning slot creates one daily question notification'
);

select is(
  (select count(*)::int from public.notifications
   where user_id = current_setting('t.student')::uuid
     and kind = 'daily_questions'
     and event_key = 'daily_questions:' || current_setting('t.student') || ':2026-10-24:0'),
  1,
  'slot is idempotent within the same window'
);

select ok(
  (select position(E'\n\n' in body) = 0 from public.notifications
   where user_id = current_setting('t.student')::uuid
     and event_key = 'daily_questions:' || current_setting('t.student') || ':2026-10-24:0'),
  'each notification carries a single question prompt'
);

select is(
  private.prepare_daily_questions('2026-10-24 09:30:00+00'::timestamptz),
  0,
  'repeat worker pass does not duplicate the morning slot'
);

select is(
  private.prepare_daily_questions('2026-10-24 13:00:00+00'::timestamptz),
  1,
  'afternoon slot delivers a separate question'
);

select is(
  (select count(*)::int from public.notifications
   where user_id = current_setting('t.student')::uuid
     and kind = 'daily_questions'
     and context->>'date' = '2026-10-24'),
  2,
  'two slots yield two distinct inbox rows'
);

select ok(
  (select count(distinct coalesce(context->>'question_version_id', context->'question_ids'->>0)) = 2
   from public.notifications
   where user_id = current_setting('t.student')::uuid
     and kind = 'daily_questions'
     and context->>'date' = '2026-10-24'),
  'same-day slots do not reuse the same question'
);

select ok(
  private.push_relevant(n)
  from public.notifications n
  where n.user_id = current_setting('t.student')::uuid
    and n.kind = 'daily_questions'
    and n.event_key = 'daily_questions:' || current_setting('t.student') || ':2026-10-24:0',
  'eligible daily question remains push-relevant'
);

select * from finish();
rollback;
