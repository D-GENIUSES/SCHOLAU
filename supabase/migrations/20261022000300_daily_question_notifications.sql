-- Three daily published-question digests, four hours apart in the saved timezone.
create function private.prepare_daily_questions(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare p record; local_now timestamp; slot integer; ids jsonb; bodies text; n integer:=0;
begin
 for p in select u.id,coalesce(pref.timezone,'Africa/Lagos') as timezone
   from public.profiles u left join private.notification_preferences pref on pref.user_id=u.id
   where u.deactivated_at is null and coalesce(pref.academic,true)
 loop
   local_now:=p_now at time zone p.timezone;
   slot:=floor((extract(hour from local_now)-8)/4)::integer;
   if slot not between 0 and 2 then continue; end if;
   perform pg_advisory_xact_lock(hashtextextended('daily-questions:'||p.id,0));
   if exists(select 1 from public.notifications where event_key='daily_questions:'||p.id||':'||local_now::date||':'||slot) then continue; end if;
   -- Only published learning questions accessible through a published assessment.
   -- Distinct questions across today's slots; draft and battle-only pools are excluded.
   select jsonb_agg(x.id),string_agg(left(x.prompt,180),E'\n\n' order by x.id)
   into ids,bodies from (
     select distinct qv.id,qv.prompt
     from public.question_versions qv join public.questions q on q.id=qv.question_id
     join public.assessment_questions aq on aq.question_version_id=qv.id
     join public.assessment_versions av on av.id=aq.assessment_version_id and av.status='published'
     join public.assessments a on a.id=av.assessment_id and a.course_id=q.course_id
     join public.course_offerings o on o.course_id=q.course_id and o.status='published'
     join public.enrollments e on e.offering_id=o.id and e.user_id=p.id and e.ended_at is null
     where qv.status='published' and q.pool='learning'
       and not exists(select 1 from public.notifications prev
         where prev.user_id=p.id and prev.kind='daily_questions' and prev.context->>'date'=local_now::date::text
           and prev.context->'question_ids' @> jsonb_build_array(qv.id))
     order by qv.id limit 3
   ) x;
   if jsonb_array_length(ids)=3 then
     perform private.notification_event(p.id,'daily_questions',bodies,'/study',
       'daily_questions:'||p.id||':'||local_now::date||':'||slot,'academic',
       jsonb_build_object('date',local_now::date,'slot',slot,'question_ids',ids),
       ((local_now::date+time '08:00')+make_interval(hours=>(slot+1)*4)) at time zone p.timezone,
       '3 questions for you');
     n:=n+1;
   end if;
 end loop;
 return n;
end $$;
revoke all on function private.prepare_daily_questions(timestamptz) from public,anon,authenticated;

alter function public.prepare_push_batch_v1() rename to prepare_push_batch_before_daily_questions;
revoke all on function public.prepare_push_batch_before_daily_questions() from public,anon,authenticated;
create function public.prepare_push_batch_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.prepare_push_batch_before_daily_questions();
 return result||jsonb_build_object('daily_questions',private.prepare_daily_questions());
end $$;
revoke all on function public.prepare_push_batch_v1() from public,anon,authenticated;
grant execute on function public.prepare_push_batch_v1() to service_role;

-- Recheck publication and enrollment immediately before queued delivery or navigation.
alter function private.push_relevant(public.notifications) rename to push_relevant_before_daily_questions;
create function private.push_relevant(n public.notifications) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if n.kind='daily_questions' then
   if n.context->>'date' is distinct from (now() at time zone coalesce(
     (select timezone from private.notification_preferences where user_id=n.user_id),'Africa/Lagos'))::date::text
     then return false; end if;
   if (select count(distinct qv.id) from public.question_versions qv
     join public.questions q on q.id=qv.question_id and q.pool='learning'
     join public.assessment_questions aq on aq.question_version_id=qv.id
     join public.assessment_versions av on av.id=aq.assessment_version_id and av.status='published'
     join public.assessments a on a.id=av.assessment_id and a.course_id=q.course_id
     join public.course_offerings o on o.course_id=q.course_id and o.status='published'
     join public.enrollments e on e.offering_id=o.id and e.user_id=n.user_id and e.ended_at is null
     where qv.status='published' and n.context->'question_ids' @> jsonb_build_array(qv.id))<>3
     then return false; end if;
 end if;
 return private.push_relevant_before_daily_questions(n);
end $$;
revoke all on function private.push_relevant(public.notifications),private.push_relevant_before_daily_questions(public.notifications)
 from public,anon,authenticated;
;
