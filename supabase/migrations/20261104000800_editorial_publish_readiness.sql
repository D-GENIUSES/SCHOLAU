-- Editorial quality report; deliberately does not rewrite legacy publication RPCs.
-- Reviewers must check this report before treating any topic as learning-loop ready.
create function public.get_course_publish_readiness_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_course uuid; v_rows jsonb;
begin
  if not private.can_manage_ingestion_for_offering(v_uid,p_offering_id) then
    perform private.raise_error('FORBIDDEN'); end if;
  select course_id into v_course from public.course_offerings
    where id=p_offering_id and status='published';
  if v_course is null then perform private.raise_error('NOT_FOUND'); end if;
  with lessons as (
    select l.id as lesson_id, lv.id as lesson_version_id,lv.title,lv.status,
      lv.editorial_status,lv.blocks,
      exists(select 1 from jsonb_array_elements(lv.blocks) b
        where b->>'type'='worked_example'
          or (b->>'type'='callout' and b->>'tone'='example')) as has_example,
      exists(select 1 from jsonb_array_elements(lv.blocks) b
        where b->>'type'='checkpoint') as has_checkpoint,
      (select count(*) from public.questions q
        join public.question_versions qv on qv.question_id=q.id
        where q.lesson_id=l.id and q.pool='learning'
          and qv.status='published' and qv.editorial_status is distinct from 'flagged'
          and (array['review','practice']::text[] && qv.usage))::integer as question_count,
      exists(select 1 from public.questions q
        join public.question_versions qv on qv.question_id=q.id
        where q.lesson_id=l.id and qv.editorial_status='flagged') as flagged_question
    from public.lessons l
    cross join lateral (
      select v.* from public.lesson_versions v
      where v.lesson_id=l.id and v.status in ('draft','published')
      order by v.version desc limit 1
    ) lv
    where l.course_id=v_course
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'lesson_id',x.lesson_id,'version_id',x.lesson_version_id,'title',x.title,
    'status',x.status,'ready',x.ready,'questions',x.question_count,
    'has_example',x.has_example,'has_checkpoint',x.has_checkpoint,
    'flagged',x.editorial_status='flagged' or x.flagged_question,
    'issues',x.issues) order by x.title),'[]'::jsonb) into v_rows
  from (
    select l.*,
      (l.has_example and l.has_checkpoint and l.question_count>=3
        and l.editorial_status is distinct from 'flagged' and not l.flagged_question) as ready,
      array_remove(array[
        case when not l.has_example then 'Worked example is missing' end,
        case when not l.has_checkpoint then 'Checkpoint is missing' end,
        case when l.question_count<3 then 'Needs at least three reviewed learning questions' end,
        case when l.editorial_status='flagged' then 'Lesson source is flagged' end,
        case when l.flagged_question then 'A linked question is flagged' end
      ],null) as issues
    from lessons l
  ) x;
  return private.envelope(jsonb_build_object('items',v_rows));
end;
$$;
revoke all on function public.get_course_publish_readiness_v1(uuid) from public,anon;
grant execute on function public.get_course_publish_readiness_v1(uuid) to authenticated;