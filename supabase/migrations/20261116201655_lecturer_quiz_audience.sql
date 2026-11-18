-- Restrict shared-course class quizzes to selected sibling programme offerings.
begin;

create or replace function private.quiz_audience_normalize(p_offering uuid, p_audience jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare mode text := coalesce(p_audience->>'mode', 'all_programmes'); ids uuid[];
begin
  if mode = 'all_programmes' then return jsonb_build_object('mode', mode, 'offering_ids', '[]'::jsonb); end if;
  if mode <> 'selected_programmes' or jsonb_typeof(p_audience->'offering_ids') is distinct from 'array'
     or jsonb_array_length(p_audience->'offering_ids') = 0 then
    perform private.raise_error('VALIDATION_FAILED', 'Select at least one programme for this quiz.');
  end if;
  begin
    select array_agg(distinct value::uuid order by value::uuid) into ids
    from jsonb_array_elements_text(p_audience->'offering_ids') selected(value);
  exception when invalid_text_representation then
    perform private.raise_error('VALIDATION_FAILED', 'Choose valid programmes for this course.');
  end;
  if cardinality(ids) = 0 or exists (
    select 1 from unnest(ids) chosen(id)
    where not exists (select 1 from private.shared_course_offerings(p_offering) as sibling(id) where sibling.id = chosen.id)
  ) then perform private.raise_error('VALIDATION_FAILED', 'Choose programmes that share this course.'); end if;
  return jsonb_build_object('mode', mode, 'offering_ids', to_jsonb(ids));
end $$;

create or replace function private.quiz_audience_offering_ids(q private.lecturer_course_quizzes)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select sibling.id from private.shared_course_offerings(q.offering_id) as sibling(id)
  where coalesce(q.settings->'audience'->>'mode', 'all_programmes') = 'all_programmes'
     or (q.settings->'audience'->>'mode' = 'selected_programmes'
       and q.settings->'audience'->'offering_ids' @> jsonb_build_array(sibling.id::text)
       and (select count(*) from jsonb_array_elements_text(q.settings->'audience'->'offering_ids')) > 0
       and not exists (
         select 1 from jsonb_array_elements_text(q.settings->'audience'->'offering_ids') selected(value)
         where not exists (select 1 from private.shared_course_offerings(q.offering_id) all_sibling where all_sibling::text = selected.value)
       ))
$$;

create or replace function private.quiz_audience_eligible(p_quiz_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.lecturer_course_quizzes q
    join private.quiz_audience_offering_ids(q) allowed(offering_id) on true
    join public.enrollments e on e.offering_id = allowed.offering_id and e.user_id = p_user_id and e.ended_at is null
    where q.id = p_quiz_id and private.challenge_student(e.offering_id, p_user_id)
  )
$$;

create or replace function private.quiz_student_can_access(p_quiz_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.lecturer_course_quizzes q
    where q.id=p_quiz_id and private.quiz_class_student(q.offering_id,p_user_id))
    and private.quiz_audience_eligible(p_quiz_id,p_user_id)
$$;

revoke all on function private.quiz_audience_normalize(uuid,jsonb), private.quiz_audience_offering_ids(private.lecturer_course_quizzes), private.quiz_audience_eligible(uuid,uuid), private.quiz_student_can_access(uuid,uuid) from public,anon,authenticated;

create or replace function private.quiz_summary(q private.lecturer_course_quizzes) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id',q.id,'offering_id',q.offering_id,'title',q.title,'instructions',q.instructions,
    'duration_minutes',q.duration_minutes,'state',private.quiz_display_state(q),'opens_at',q.opens_at,
    'closes_at',q.closes_at,'revision',q.revision,'question_count',jsonb_array_length(q.questions),
    'max_attempts',coalesce((q.settings->>'max_attempts')::int,1),
    'feedback_mode',coalesce(q.settings->>'feedback_mode','after_submit'),
    'audience_mode',coalesce(q.settings->'audience'->>'mode','all_programmes'),
    'audience_offering_ids',coalesce(q.settings->'audience'->'offering_ids','[]'::jsonb),
    'audience_programmes',coalesce((select jsonb_agg(d.name order by d.name)
      from private.quiz_audience_offering_ids(q) ids(id)
      join public.course_offerings o on o.id=ids.id join public.departments d on d.id=o.department_id),'[]'::jsonb)
  )
$$;

create or replace function public.get_lecturer_quiz_audience_options_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare u uuid:=private.require_user(); items jsonb;
begin
  if not private.challenge_teacher(p_offering_id,u) then perform private.raise_error('FORBIDDEN'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',sibling.id,'department_name',d.name) order by d.name,sibling.id),'[]'::jsonb)
  into items from private.shared_course_offerings(p_offering_id) as sibling(id)
  join public.course_offerings o on o.id=sibling join public.departments d on d.id=o.department_id;
  return private.envelope(jsonb_build_object('items',items));
end $$;

create or replace function public.preview_lecturer_quiz_audience_v1(p_offering_id uuid,p_audience jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare u uuid:=private.require_user(); normalized jsonb; ids uuid[]; recipients jsonb; total integer;
begin
  if not private.challenge_teacher(p_offering_id,u) then perform private.raise_error('FORBIDDEN'); end if;
  normalized:=private.quiz_audience_normalize(p_offering_id,p_audience);
  if normalized->>'mode'='all_programmes' then
    select array_agg(sibling.id order by sibling.id) into ids from private.shared_course_offerings(p_offering_id) as sibling(id);
  else
    select array_agg(value::uuid order by value::uuid) into ids from jsonb_array_elements_text(normalized->'offering_ids') x(value);
  end if;
  select count(distinct e.user_id)::int,coalesce(jsonb_agg(jsonb_build_object('id',o.id,'department_name',d.name,'recipient_count',counts.n) order by d.name),'[]'::jsonb)
    into total,recipients from public.course_offerings o join public.departments d on d.id=o.department_id
    cross join lateral (select count(distinct e.user_id)::int n from public.enrollments e where e.offering_id=o.id and e.ended_at is null and private.challenge_student(o.id,e.user_id)) counts
    left join public.enrollments e on e.offering_id=o.id and e.ended_at is null
      and private.challenge_student(o.id,e.user_id) and e.offering_id=any(ids)
    where o.id=any(ids);
  return private.envelope(jsonb_build_object('recipient_count',coalesce(total,0),'programmes',coalesce(recipients,'[]'::jsonb)));
end $$;

revoke all on function public.get_lecturer_quiz_audience_options_v1(uuid),public.preview_lecturer_quiz_audience_v1(uuid,jsonb) from public,anon;
grant execute on function public.get_lecturer_quiz_audience_options_v1(uuid),public.preview_lecturer_quiz_audience_v1(uuid,jsonb) to authenticated;

-- Preserve the existing save RPC contract while adding validated audience settings.
do $$ declare definition text;
begin
  select pg_get_functiondef('public.save_lecturer_quiz_v1(uuid,uuid,integer,jsonb)'::regprocedure) into definition;
  definition:=regexp_replace(definition,
    $pattern$'feedback_mode', case when p_data->>'feedback_mode' = 'immediate' then 'immediate' else 'after_submit' end$pattern$,
    $replacement$\&,
    'audience', private.quiz_audience_normalize(p_offering_id, p_data->'audience')$replacement$);
  if position('quiz_audience_normalize' in definition)=0 then raise exception 'Could not extend quiz save RPC'; end if;
  execute definition;
end $$;

-- Rewrite server-side access predicates. Existing in-flight attempts retain the
-- established grace path in get_course_quiz_v1; all new attempts require membership.
do $$ declare definition text; original text;
begin
  select pg_get_functiondef('public.get_course_quiz_v1(uuid)'::regprocedure) into definition;
  original:=definition;
  definition:=replace(definition,'private.quiz_class_student(q.offering_id, u)','private.quiz_student_can_access(q.id, u)');
  if definition=original then raise exception 'Could not gate quiz detail'; end if; execute definition;

  select pg_get_functiondef('public.start_lecturer_quiz_attempt_v1(uuid,text)'::regprocedure) into definition;
  definition:=replace(definition,'not private.quiz_class_student(q.offering_id, u)','not private.quiz_student_can_access(p_quiz_id, u)');
  if position('quiz_student_can_access' in definition)=0 then raise exception 'Could not gate quiz start'; end if; execute definition;

  select pg_get_functiondef('public.save_lecturer_quiz_answer_v1(uuid,integer,integer,integer)'::regprocedure) into definition;
  definition:=replace(definition,'not private.quiz_class_student(q.offering_id, u)',
    'not (private.quiz_student_can_access(p_quiz_id, u) or exists(select 1 from private.lecturer_course_quiz_attempts old_attempt where old_attempt.quiz_id=p_quiz_id and old_attempt.user_id=u))');
  if position('quiz_student_can_access' in definition)=0 then raise exception 'Could not gate quiz answer'; end if; execute definition;

  select pg_get_functiondef('public.submit_lecturer_quiz_attempt_v1(uuid,integer)'::regprocedure) into definition;
  definition:=replace(definition,'not private.quiz_class_student(q.offering_id, u)',
    'not (private.quiz_student_can_access(p_quiz_id, u) or exists(select 1 from private.lecturer_course_quiz_attempts old_attempt where old_attempt.quiz_id=p_quiz_id and old_attempt.user_id=u))');
  if position('quiz_student_can_access' in definition)=0 then raise exception 'Could not gate quiz submission'; end if; execute definition;

  select pg_get_functiondef('public.report_lecturer_quiz_integrity_v1(uuid,uuid,text)'::regprocedure) into definition;
  definition:=replace(definition,'not private.quiz_class_student(quiz.offering_id, actor)','not private.quiz_student_can_access(quiz.id, actor)');
  if position('quiz_student_can_access' in definition)=0 then raise exception 'Could not gate quiz integrity reports'; end if; execute definition;

  select pg_get_functiondef('public.list_course_quizzes_v1(uuid,integer)'::regprocedure) into definition;
  original:=definition;
  definition:=replace(definition,$old$and q.offering_id in (select private.shared_course_offerings(p_offering_id))$old$,$new$and q.offering_id in (select private.shared_course_offerings(p_offering_id))
        and private.quiz_student_can_access(q.id,u)$new$);
  if definition=original then raise exception 'Could not scope student quiz list'; end if; execute definition;

  select pg_get_functiondef('public.publish_lecturer_quiz_v1(uuid,integer)'::regprocedure) into definition;
  definition:=replace(definition,'where private.challenge_student(sibling, e.user_id)','where private.challenge_student(sibling, e.user_id) and private.quiz_audience_eligible(q.id,e.user_id)');
  if position('quiz_audience_eligible(q.id,e.user_id)' in definition)=0 then raise exception 'Could not scope quiz notifications'; end if; execute definition;

  select pg_get_functiondef('public.lecturer_quiz_roster_v1(uuid,uuid,text,integer)'::regprocedure) into definition;
  definition:=replace(definition,$old$join public.enrollments e on e.offering_id = sibling and e.ended_at is null$old$,$new$join public.enrollments e on e.offering_id = sibling and e.ended_at is null and private.quiz_audience_eligible(p_quiz_id,e.user_id)$new$);
  if position('quiz_audience_eligible(p_quiz_id,e.user_id)' in definition)=0 then raise exception 'Could not scope quiz roster'; end if; execute definition;

  select pg_get_functiondef('public.export_lecturer_quiz_results_v1(uuid)'::regprocedure) into definition;
  definition:=replace(definition,$old$join public.enrollments e on e.offering_id = sibling and e.ended_at is null$old$,$new$join public.enrollments e on e.offering_id = sibling and e.ended_at is null and private.quiz_audience_eligible(p_quiz_id,e.user_id)$new$);
  if position('quiz_audience_eligible(p_quiz_id,e.user_id)' in definition)=0 then raise exception 'Could not scope quiz export'; end if; execute definition;

  select pg_get_functiondef('private.push_relevant(public.notifications)'::regprocedure) into definition;
  definition:=overlay(definition placing $guard$
  if n.kind = 'course_quiz' and n.context ? 'quiz_id' then
    begin
      if not private.quiz_audience_eligible((n.context->>'quiz_id')::uuid,n.user_id) then return false; end if;
    exception when invalid_text_representation then return false;
    end;
  end if;
$guard$ from position('BEGIN' in upper(definition))+5 for 0);
  if position('quiz_audience_eligible' in definition)=0 then raise exception 'Could not scope quiz push notifications'; end if; execute definition;
end $$;

commit;
