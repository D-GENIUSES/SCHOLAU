-- Read-only progress projections on top of existing lesson mastery and review awards.
-- "Proficient" is the original 80%-pass mastery flag; "Mastered" requires all 3 reviews.
create function public.get_course_topic_mastery_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_rows jsonb;
begin
  v_offering := private.require_offering_enrollment(v_uid, p_offering_id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'lesson_id',x.lesson_id,'module_title',x.module_title,'title',x.title,
    'state',x.mastery_state,'review_stage',x.due_stage,
    'review_due_at',x.due_at,'review_due',x.due_at <= now()
  ) order by x.module_position, x.lesson_position), '[]'::jsonb) into v_rows
  from (
    select l.id lesson_id, m.title module_title, lv.title,
      m.position module_position, l.position lesson_position,
      case when count(r.stage)=3 then 'mastered'
           when tm.lesson_id is not null then 'proficient'
           when lp.lesson_id is not null then 'learning'
           else 'not_started' end mastery_state,
      case when tm.lesson_id is null or count(r.stage)>=3 then null
           else (count(r.stage)+1)::integer end due_stage,
      case when tm.lesson_id is null or count(r.stage)>=3 then null
           else tm.mastered_at + make_interval(days => (array[1,7,30])[(count(r.stage)+1)::integer]) end due_at
    from public.lessons l
    join public.modules m on m.id=l.module_id
    join public.lesson_versions lv on lv.lesson_id=l.id and lv.status='published'
    left join public.lesson_progress lp on lp.lesson_id=l.id and lp.user_id=v_uid
    left join private.topic_mastery tm on tm.lesson_id=l.id and tm.user_id=v_uid
    left join private.review_awards r on r.lesson_id=l.id and r.user_id=v_uid
    where l.course_id=v_offering.course_id
    group by l.id,m.title,lv.title,m.position,l.position,tm.lesson_id,tm.mastered_at,lp.lesson_id
  ) x;
  return private.envelope(jsonb_build_object('items',v_rows));
end;
$$;

create function public.get_my_next_learning_action_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_action jsonb;
begin
  -- A due review beats an accuracy gap or unfinished lesson.
  select jsonb_build_object('kind','review','title',lv.title,
    'course_code',c.code,'lesson_id',l.id,'review_stage',next_stage,
    'offering_id',e.offering_id,'href','/study/lessons/'||l.id::text)
  into v_action
  from private.topic_mastery tm
  join public.lessons l on l.id=tm.lesson_id
  join public.lesson_versions lv on lv.lesson_id=l.id and lv.status='published'
  join public.courses c on c.id=l.course_id
  join public.course_offerings o on o.course_id=l.course_id and o.status='published'
  join public.enrollments e on e.offering_id=o.id and e.user_id=v_uid and e.ended_at is null
  cross join lateral (select (count(r.stage)+1)::integer as next_stage
    from private.review_awards r where r.user_id=v_uid and r.lesson_id=l.id) stages
  where tm.user_id=v_uid and next_stage<=3
    and tm.mastered_at + make_interval(days=>(array[1,7,30])[next_stage]) <= now()
    and exists(select 1 from public.assessments a join public.assessment_versions av
      on av.assessment_id=a.id and av.status='published'
      where a.lesson_id=l.id and a.kind='review')
  order by tm.mastered_at, lv.title limit 1;

  if v_action is null then
    -- Only locked answers from finalized quizzes count as gap evidence.
    with weak as (
      select a.lesson_id, a.course_id, count(*) as answered,
        count(*) filter(where ans.is_correct)::numeric / nullif(count(*),0) as accuracy
      from public.attempt_answers ans
      join public.assessment_attempts at on at.id=ans.attempt_id
      join public.assessments a on a.id=at.assessment_id
      where at.user_id=v_uid and at.status in ('submitted','expired')
        and ans.locked_at is not null and a.lesson_id is not null
      group by a.lesson_id,a.course_id
      having count(*) >= 3
    )
    select jsonb_build_object('kind','gap','title',lv.title,'course_code',c.code,
      'lesson_id',l.id,'offering_id',e.offering_id,'href','/study/lessons/'||l.id::text)
    into v_action from weak w
    join public.lessons l on l.id=w.lesson_id
    join public.lesson_versions lv on lv.lesson_id=l.id and lv.status='published'
    join public.courses c on c.id=w.course_id
    join public.course_offerings o on o.course_id=l.course_id and o.status='published'
    join public.enrollments e on e.offering_id=o.id and e.user_id=v_uid and e.ended_at is null
    where w.accuracy <= 0.5 order by w.accuracy, w.answered desc limit 1;
  end if;

  if v_action is null then
    select jsonb_build_object('kind','lesson','title',lv.title,'course_code',c.code,
      'lesson_id',l.id,'offering_id',e.offering_id,'href','/study/lessons/'||l.id::text)
    into v_action
    from public.enrollments e
    join public.course_offerings o on o.id=e.offering_id and o.status='published'
    join public.courses c on c.id=o.course_id
    join public.lessons l on l.course_id=c.id
    join public.modules m on m.id=l.module_id
    join public.lesson_versions lv on lv.lesson_id=l.id and lv.status='published'
    left join public.lesson_progress lp on lp.lesson_id=l.id and lp.user_id=v_uid
    where e.user_id=v_uid and e.ended_at is null and coalesce(lp.state,'not_started')<>'completed'
    order by case when lp.state='started' then 0 else 1 end,
      e.enrolled_at desc,m.position,l.position limit 1;
  end if;
  return private.envelope(jsonb_build_object('action',v_action));
end;
$$;

revoke all on function public.get_course_topic_mastery_v1(uuid),
  public.get_my_next_learning_action_v1() from public,anon;
grant execute on function public.get_course_topic_mastery_v1(uuid),
  public.get_my_next_learning_action_v1() to authenticated;