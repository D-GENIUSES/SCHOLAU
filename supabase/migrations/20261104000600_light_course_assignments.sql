-- Light, non-timed assignments referring to existing published learning content.
-- Not a course challenge: no one-attempt rule, shared deadline timer, ranking or extra XP.
create table private.light_course_assignments (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id),
  created_by uuid not null references public.profiles(id),
  title text not null check (length(btrim(title)) between 1 and 160),
  lesson_id uuid references public.lessons(id),
  assessment_version_id uuid references public.assessment_versions(id),
  due_at timestamptz not null,
  status text not null default 'active' check (status in ('active','cancelled')),
  created_at timestamptz not null default now(),
  check ((lesson_id is null) <> (assessment_version_id is null))
);
create index light_assignments_scope on private.light_course_assignments(offering_id,status,due_at);
alter table private.light_course_assignments enable row level security;
revoke all on private.light_course_assignments from public,anon,authenticated;

create function public.get_light_assignment_targets_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_course uuid; v_items jsonb;
begin
  if not private.challenge_teacher(p_offering_id,v_uid) and not exists (
    select 1 from public.user_roles where user_id=v_uid and role='admin'
  ) then perform private.raise_error('FORBIDDEN'); end if;
  select course_id into v_course from public.course_offerings
  where id=p_offering_id and status='published';
  if v_course is null then perform private.raise_error('NOT_FOUND'); end if;
  select coalesce(jsonb_agg(x.item order by x.kind,x.title),'[]'::jsonb) into v_items
  from (
    select 'lesson' as kind,lv.title, jsonb_build_object('kind','lesson','id',l.id,'title',lv.title) item
    from public.lessons l join public.lesson_versions lv on lv.lesson_id=l.id and lv.status='published'
    where l.course_id=v_course
    union all
    select 'practice',a.title,jsonb_build_object('kind','practice','id',av.id,'title',a.title)
    from public.assessments a join public.assessment_versions av on av.assessment_id=a.id and av.status='published'
    where a.course_id=v_course and a.kind='practice'
  ) x;
  return private.envelope(jsonb_build_object('items',v_items));
end;
$$;

create function public.create_light_assignment_v1(
  p_offering_id uuid,p_title text,p_lesson_id uuid,
  p_assessment_version_id uuid,p_due_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_course uuid; v_id uuid;
begin
  if not private.challenge_teacher(p_offering_id,v_uid) and not exists (
    select 1 from public.user_roles where user_id=v_uid and role='admin'
  ) then perform private.raise_error('FORBIDDEN'); end if;
  select course_id into v_course from public.course_offerings where id=p_offering_id and status='published';
  if v_course is null then perform private.raise_error('NOT_FOUND'); end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 160
    or (p_lesson_id is null)=(p_assessment_version_id is null)
    or p_due_at is null or p_due_at < now() or p_due_at > now()+interval '180 days'
  then perform private.raise_error('VALIDATION_FAILED'); end if;
  if p_lesson_id is not null and not exists (
    select 1 from public.lessons l join public.lesson_versions lv
      on lv.lesson_id=l.id and lv.status='published'
    where l.id=p_lesson_id and l.course_id=v_course
  ) then perform private.raise_error('VALIDATION_FAILED','Choose a published course lesson.'); end if;
  if p_assessment_version_id is not null and not exists (
    select 1 from public.assessment_versions av
    join public.assessments a on a.id=av.assessment_id
    where av.id=p_assessment_version_id and av.status='published'
      and a.course_id=v_course and a.kind='practice'
  ) then perform private.raise_error('VALIDATION_FAILED','Choose a published course practice set.'); end if;
  if (select count(*) from private.light_course_assignments
      where offering_id=p_offering_id and status='active' and due_at>now()) >= 30 then
    perform private.raise_error('VALIDATION_FAILED','Too many active assignments.');
  end if;
  insert into private.light_course_assignments(offering_id,created_by,title,lesson_id,assessment_version_id,due_at)
  values(p_offering_id,v_uid,btrim(p_title),p_lesson_id,p_assessment_version_id,p_due_at)
  returning id into v_id;
  return private.envelope(jsonb_build_object('id',v_id,'status','active'));
end;
$$;

create function public.list_light_assignments_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_teacher boolean; v_rows jsonb;
begin
  v_teacher := private.challenge_teacher(p_offering_id,v_uid) or exists (
    select 1 from public.user_roles where user_id=v_uid and role='admin');
  if not v_teacher then perform private.require_offering_enrollment(v_uid,p_offering_id); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'title',a.title,'kind',case when a.lesson_id is not null then 'lesson' else 'practice' end,
      'target_id',coalesce(a.lesson_id,a.assessment_version_id),'due_at',a.due_at,
      'status',a.status,'completed',case when a.lesson_id is not null
        then exists(select 1 from public.lesson_progress lp where lp.lesson_id=a.lesson_id
          and lp.user_id=v_uid and lp.state='completed')
        else exists(select 1 from public.assessment_attempts at where at.user_id=v_uid
          and at.offering_id=p_offering_id and at.assessment_version_id=a.assessment_version_id
          and at.status='submitted') end
    ) order by a.due_at,a.created_at), '[]'::jsonb) into v_rows
  from private.light_course_assignments a
  where a.offering_id=p_offering_id and (v_teacher or a.status='active');
  return private.envelope(jsonb_build_object('items',v_rows,'teacher',v_teacher));
end;
$$;

create function public.cancel_light_assignment_v1(p_assignment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_offering uuid;
begin
  select offering_id into v_offering from private.light_course_assignments where id=p_assignment_id for update;
  if v_offering is null then perform private.raise_error('NOT_FOUND'); end if;
  if not private.challenge_teacher(v_offering,v_uid) and not exists (
    select 1 from public.user_roles where user_id=v_uid and role='admin'
  ) then perform private.raise_error('FORBIDDEN'); end if;
  update private.light_course_assignments set status='cancelled' where id=p_assignment_id;
  return private.envelope(jsonb_build_object('id',p_assignment_id,'status','cancelled'));
end;
$$;

revoke all on function public.get_light_assignment_targets_v1(uuid),
  public.create_light_assignment_v1(uuid,text,uuid,uuid,timestamptz),
  public.list_light_assignments_v1(uuid),
  public.cancel_light_assignment_v1(uuid) from public,anon;
grant execute on function public.get_light_assignment_targets_v1(uuid),
  public.create_light_assignment_v1(uuid,text,uuid,uuid,timestamptz),
  public.list_light_assignments_v1(uuid),
  public.cancel_light_assignment_v1(uuid) to authenticated;