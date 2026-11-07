-- Share eligibility checks for bank versions and public catalog alignment.

create or replace function public.can_share_bank_question_v1(p_kind text, p_version uuid, p_checkpoint integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_kind is null or p_kind not in ('bank', 'checkpoint') or p_version is null or p_checkpoint is null
      or (p_kind = 'bank' and p_checkpoint <> 0) or (p_kind = 'checkpoint' and p_checkpoint < 1)
    then false
    else private.shared_study_payload(p_kind, p_version, p_checkpoint) is not null
  end;
$$;

create or replace function public.can_share_bank_questions_v1(p_versions uuid[])
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    jsonb_object_agg(v::text, private.shared_study_payload('bank', v, 0) is not null),
    '{}'::jsonb
  )
  from unnest(coalesce(p_versions, array[]::uuid[])) as u(v);
$$;

create or replace function public.can_share_catalog_question_v1(p_course_code text, p_key text, p_prompt text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1
    from public.courses c
    where c.code = p_course_code
      and exists (
        select 1 from public.questions q
        where q.course_id = c.id and q.logical_key = p_key
      )
      and (
        not c.active
        or private.study_question_is_protected(c.id,
          (select id from public.questions where course_id = c.id and logical_key = p_key), p_prompt)
        or exists (
          select 1 from public.questions q join public.question_versions v on v.question_id = q.id
          where q.course_id = c.id and q.logical_key = p_key and v.prompt = p_prompt and v.status = 'retired'
            and not exists (
              select 1 from public.question_versions live
              where live.question_id = q.id and live.prompt = p_prompt and live.status = 'published'
                and live.usage && array['practice', 'review']
            )
        )
      )
  );
$$;

revoke all on function public.can_share_bank_question_v1(text, uuid, integer),
  public.can_share_bank_questions_v1(uuid[]) from public, anon, authenticated;
grant execute on function public.can_share_bank_question_v1(text, uuid, integer),
  public.can_share_bank_questions_v1(uuid[]) to authenticated;
grant execute on function public.can_share_bank_question_v1(text, uuid, integer)
  to anon;
