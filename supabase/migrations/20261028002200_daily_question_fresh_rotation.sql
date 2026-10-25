-- Keep daily questions fresh across days, slots, versions and duplicate prompts.
create table if not exists private.daily_question_history (
 user_id uuid not null references public.profiles(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete cascade,
 prompt_fingerprint text not null,
 first_sent_at timestamptz not null default now(),
 primary key(user_id,question_id),
 unique(user_id,prompt_fingerprint)
);
revoke all on private.daily_question_history from public,anon,authenticated;
-- Preserve all recoverable prior sends; do not reset rotation on release.
insert into private.daily_question_history(user_id,question_id,prompt_fingerprint,first_sent_at)
select n.user_id,q.id,md5(regexp_replace(lower(btrim(v.prompt)),'[[:space:][:punct:]]+','','g')),min(n.created_at)
from public.notifications n
cross join lateral jsonb_array_elements_text(case when jsonb_typeof(n.context->'question_ids')='array' then n.context->'question_ids' else '[]'::jsonb end) x(id)
join public.question_versions v on v.id::text=x.id
join public.questions q on q.id=v.question_id
where n.kind='daily_questions'
group by n.user_id,q.id,v.prompt
order by min(n.created_at)
on conflict do nothing;
create or replace function private.prepare_daily_questions(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare p record; local_now timestamp; slot integer; ids jsonb; bodies text; fingerprints jsonb; n integer:=0; amount integer;
begin
 for p in select u.id,coalesce(pref.timezone,'Africa/Lagos') timezone
 from public.profiles u left join private.notification_preferences pref on pref.user_id=u.id
 where u.deactivated_at is null and coalesce(pref.academic,true)
 loop
  local_now:=p_now at time zone p.timezone;
  slot:=floor((extract(hour from local_now)-8)/4)::integer;
  if slot not between 0 and 2 then continue; end if;
  perform pg_advisory_xact_lock(hashtextextended('daily-questions:'||p.id,0));
  if exists(select 1 from public.notifications where event_key='daily_questions:'||p.id||':'||local_now::date||':'||slot) then continue; end if;
  with eligible as (
   select distinct q.id question_id,q.course_id,v.id,v.prompt,
    md5(regexp_replace(lower(btrim(v.prompt)),'[[:space:][:punct:]]+','','g')) fingerprint
   from public.question_versions v join public.questions q on q.id=v.question_id
   join public.assessment_questions aq on aq.question_version_id=v.id
   join public.assessment_versions av on av.id=aq.assessment_version_id and av.status='published'
   join public.assessments a on a.id=av.assessment_id and a.course_id=q.course_id
   where v.status='published' and q.pool='learning' and btrim(v.prompt)<>''
   and exists(select 1 from public.course_offerings o join public.enrollments e on e.offering_id=o.id
    where o.course_id=q.course_id and o.status='published' and e.user_id=p.id and e.ended_at is null)
   and not exists(select 1 from private.daily_question_history h where h.user_id=p.id and
    (h.question_id=q.id or h.prompt_fingerprint=md5(regexp_replace(lower(btrim(v.prompt)),'[[:space:][:punct:]]+','','g'))))
  ), canonical as (
   select distinct on(fingerprint) * from eligible order by fingerprint,question_id,id
  ), one_version as (
   select distinct on(question_id) * from canonical order by question_id,id
  ), ranked as (
   select *,row_number() over(partition by course_id order by md5(p.id::text||local_now::date::text||slot::text||id::text)) course_rank
   from one_version
  ), chosen as (
   select * from ranked order by course_rank,md5(p.id::text||local_now::date::text||slot::text||course_id::text),id limit 3
  )
  select jsonb_agg(id order by course_rank,course_id,id),
   string_agg(left(prompt,180),E'\n\n' order by course_rank,course_id,id),
   jsonb_agg(jsonb_build_object('question_id',question_id,'fingerprint',fingerprint))
  into ids,bodies,fingerprints from chosen;
  amount:=coalesce(jsonb_array_length(ids),0);
  -- Send only fresh items. A small/exhausted pool must never force a repeat.
  if amount>0 then
   perform private.notification_event(p.id,'daily_questions',bodies,'/study',
    'daily_questions:'||p.id||':'||local_now::date||':'||slot,'academic',
    jsonb_build_object('date',local_now::date,'slot',slot,'question_ids',ids),
    ((local_now::date+time '08:00')+make_interval(hours=>(slot+1)*4)) at time zone p.timezone,
    case when amount=1 then '1 fresh question for you' else amount::text||' fresh questions for you' end);
   if exists(select 1 from public.notifications where event_key='daily_questions:'||p.id||':'||local_now::date||':'||slot) then
    insert into private.daily_question_history(user_id,question_id,prompt_fingerprint,first_sent_at)
    select p.id,(item->>'question_id')::uuid,item->>'fingerprint',p_now from jsonb_array_elements(fingerprints) item
    on conflict do nothing;
    n:=n+1;
   end if;
  end if;
 end loop;
 return n;
end $$;
revoke all on function private.prepare_daily_questions(timestamptz) from public,anon,authenticated;
