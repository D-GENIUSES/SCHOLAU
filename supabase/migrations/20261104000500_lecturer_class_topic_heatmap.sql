-- Class-scoped heatmap for an assigned lecturer (same minimum of five paired learners).
-- No learner identifiers or individual results are returned.
create function public.get_lecturer_topic_heatmap_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_course text;
  v_rows jsonb;
  v_hidden integer;
begin
  if not private.challenge_teacher(p_offering_id,v_uid) and not exists (
    select 1 from public.user_roles where user_id=v_uid and role='admin'
  ) then perform private.raise_error('FORBIDDEN'); end if;

  select c.code into v_course
  from public.course_offerings o join public.courses c on c.id=o.course_id
  where o.id=p_offering_id and o.status='published';
  if v_course is null then perform private.raise_error('NOT_FOUND'); end if;

  with paired as (
    select p.topic_key, p.user_id,
      p.score::numeric / nullif(p.total,0) as pre_ratio,
      post.score::numeric / nullif(post.total,0) as post_ratio
    from public.topic_check_attempts p
    join public.topic_check_attempts post on post.user_id=p.user_id
       and post.course_code=p.course_code and post.topic_key=p.topic_key and post.kind='post'
    join public.enrollments e on e.user_id=p.user_id and e.offering_id=p_offering_id
       and e.ended_at is null
    where p.kind='pre' and p.course_code=v_course
  ), grouped as (
    select topic_key,count(*)::integer as students,
      round(avg(pre_ratio)*100,1) as before_percent,
      round(avg(post_ratio)*100,1) as after_percent,
      round(avg(post_ratio-pre_ratio)*100,1) as gain_percent
    from paired group by topic_key
  )
  select coalesce((select jsonb_agg(jsonb_build_object(
      'topic_key',g.topic_key,
      'topic_title',coalesce((select i.topic_title from public.topic_check_items i
        where i.course_code=v_course and i.topic_key=g.topic_key limit 1),g.topic_key),
      'students',g.students,'before_percent',g.before_percent,
      'after_percent',g.after_percent,'gain_percent',g.gain_percent)
      order by g.after_percent asc, g.topic_key)
      from grouped g where g.students>=5),'[]'::jsonb),
    coalesce((select count(*) from grouped g where g.students<5),0)
  into v_rows,v_hidden;

  return private.envelope(jsonb_build_object(
    'course_code',v_course,'offering_id',p_offering_id,
    'minimum_students',5,'rows',v_rows,'suppressed_cells',v_hidden));
end;
$$;
revoke all on function public.get_lecturer_topic_heatmap_v1(uuid) from public,anon;
grant execute on function public.get_lecturer_topic_heatmap_v1(uuid) to authenticated;