-- Optional editorial, incremental hints for formative practice only.
-- A question is never allowed to reveal private answer keys through this RPC.
create table private.practice_question_hints (
  question_version_id uuid not null references public.question_versions(id) on delete cascade,
  step integer not null check (step between 1 and 4),
  hint_text text not null check (length(btrim(hint_text)) between 10 and 400),
  approved_by uuid not null references public.profiles(id),
  approved_at timestamptz not null default now(),
  primary key(question_version_id,step)
);
alter table private.practice_question_hints enable row level security;
revoke all on private.practice_question_hints from public,anon,authenticated;

create function public.admin_set_practice_hints_v1(p_question_version_id uuid,p_hints jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_admin(); v_text text; v_i integer := 0;
begin
  if not exists(select 1 from public.question_versions
                where id=p_question_version_id and status in ('draft','published'))
      or jsonb_typeof(p_hints) is distinct from 'array'
      or jsonb_array_length(p_hints) not between 1 and 4 then
    perform private.raise_error('VALIDATION_FAILED'); end if;
  for v_text in select value from jsonb_array_elements_text(p_hints) loop
    if length(btrim(v_text)) not between 10 and 400 then
      perform private.raise_error('VALIDATION_FAILED','Hint must be 10-400 characters.'); end if;
  end loop;
  delete from private.practice_question_hints where question_version_id=p_question_version_id;
  for v_text in select value from jsonb_array_elements_text(p_hints) loop
    v_i := v_i+1;
    insert into private.practice_question_hints(question_version_id,step,hint_text,approved_by)
      values(p_question_version_id,v_i,btrim(v_text),v_uid);
  end loop;
  return private.envelope(jsonb_build_object('hint_count',v_i));
end;
$$;

create function public.get_practice_hint_v1(
  p_attempt_id uuid,p_question_version_id uuid,p_step integer
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_hint text; v_count integer;
begin
  if p_step not between 1 and 4 then perform private.raise_error('VALIDATION_FAILED'); end if;
  if not exists(
    select 1 from public.assessment_attempts at
    join public.assessments a on a.id=at.assessment_id
    join public.attempt_questions aq on aq.attempt_id=at.id
    where at.id=p_attempt_id and at.user_id=v_uid
      and at.status='active' and a.kind='practice'
      and aq.question_version_id=p_question_version_id
  ) then perform private.raise_error('FORBIDDEN','Hints are only available during your own active untimed practice.'); end if;
  select count(*) into v_count from private.practice_question_hints
    where question_version_id=p_question_version_id;
  select hint_text into v_hint from private.practice_question_hints
    where question_version_id=p_question_version_id and step=p_step;
  return private.envelope(jsonb_build_object('step',p_step,'hint',v_hint,'hint_count',v_count));
end;
$$;

-- Completed, incorrectly answered questions map to a published course lesson.
-- The client opens the worked-example step, not a hidden answer key.
create function public.get_result_reteach_targets_v1(p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_items jsonb;
begin
  if not exists(select 1 from public.assessment_attempts at
    where at.id=p_attempt_id and at.user_id=v_uid and at.status in ('submitted','expired'))
  then perform private.raise_error('FORBIDDEN'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'question_version_id',qv.id,'lesson_id',l.id,
    'lesson_title',lv.title) order by aq.position),'[]'::jsonb)
  into v_items
  from public.assessment_attempts at
  join public.assessments a on a.id=at.assessment_id
  join public.attempt_questions aq on aq.attempt_id=at.id
  join public.attempt_answers ans on ans.attempt_id=at.id and ans.question_version_id=aq.question_version_id
  join public.question_versions qv on qv.id=aq.question_version_id
  join public.questions q on q.id=qv.question_id
  join public.lessons l on l.id=coalesce(q.lesson_id,a.lesson_id)
  join public.lesson_versions lv on lv.lesson_id=l.id and lv.status='published'
  where at.id=p_attempt_id and at.user_id=v_uid
    and at.status in ('submitted','expired') and ans.is_correct=false;
  return private.envelope(jsonb_build_object('items',v_items));
end;
$$;

revoke all on function public.admin_set_practice_hints_v1(uuid,jsonb),
  public.get_practice_hint_v1(uuid,uuid,integer),
  public.get_result_reteach_targets_v1(uuid) from public,anon;
grant execute on function public.admin_set_practice_hints_v1(uuid,jsonb),
  public.get_practice_hint_v1(uuid,uuid,integer),
  public.get_result_reteach_targets_v1(uuid) to authenticated;