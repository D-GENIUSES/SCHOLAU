create or replace function public.start_configured_attempt_v1(
  p_assessment_version_id uuid, p_request_key uuid, p_question_count integer, p_duration_seconds integer, p_resume boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_version public.assessment_versions;
  v_assessment public.assessments;
  v_offering uuid;
  v_existing public.assessment_attempts;
  v_attempt_id uuid;
  v_available integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('scholau.start:' || v_uid::text,0));
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);

  select * into v_existing from public.assessment_attempts where user_id = v_uid and request_key = p_request_key;
  if found then
    return private.envelope(private.attempt_payload(v_existing.id) || jsonb_build_object('resumed', true), p_request_key);
  end if;

  select * into v_version from public.assessment_versions where id = p_assessment_version_id;
  if not found or v_version.status <> 'published' then
    perform private.raise_error('CONTENT_UNAVAILABLE');
  end if;
  select * into v_assessment from public.assessments where id = v_version.assessment_id;
  if v_assessment.kind not in ('mock','practice') then
    perform private.raise_error('VALIDATION_FAILED','Only practice and mock exams can be customized.');
  end if;
  if p_question_count is null or p_question_count < 1 or p_question_count > v_version.question_count then
    perform private.raise_error('VALIDATION_FAILED','Choose a question count within the available bank.');
  end if;
  if (v_assessment.kind='mock' and p_duration_seconds is null)
    or (p_duration_seconds is not null and (p_duration_seconds < 60 or p_duration_seconds > 14400 or p_duration_seconds % 60 <> 0)) then
    perform private.raise_error('VALIDATION_FAILED','Choose a time limit between 1 and 240 minutes.');
  end if;
  v_offering := private.require_course_enrollment(v_uid, v_assessment.course_id);

  select * into v_existing from public.assessment_attempts
  where user_id = v_uid and assessment_id = v_assessment.id and status = 'active'
  for update;
  if found then
    if v_existing.expires_at is not null and v_existing.expires_at <= now() then
      perform private.finalize_attempt(v_existing.id, 'expired');
    elsif p_resume then
      return private.envelope(private.attempt_payload(v_existing.id) || jsonb_build_object('resumed', true), p_request_key);
    else
      perform private.raise_error('ATTEMPT_ACTIVE', null, jsonb_build_object('attempt_id', v_existing.id));
    end if;
  end if;

  select count(*) into v_available
  from public.assessment_questions aq
  join public.question_versions qv on qv.id = aq.question_version_id and qv.status = 'published'
  where aq.assessment_version_id = v_version.id;
  if v_available < p_question_count then
    perform private.raise_error('CONTENT_UNAVAILABLE', 'This assessment does not have enough published questions.');
  end if;

  begin
    insert into public.assessment_attempts (user_id, offering_id, assessment_id, assessment_version_id, request_key,
                                            started_at, expires_at, scoring_version, feedback_mode, total_count)
    values (v_uid, v_offering, v_assessment.id, v_version.id, p_request_key, now(),
            case when p_duration_seconds is null then null
                 else now() + make_interval(secs => p_duration_seconds) end,
            v_version.scoring_version, v_version.feedback_mode, p_question_count)
    returning id into v_attempt_id;
  exception when unique_violation then
    perform private.raise_error('ATTEMPT_ACTIVE', 'Another attempt was started at the same time.');
  end;

  insert into public.attempt_questions (attempt_id, question_version_id, position, option_order)
  select v_attempt_id, s.qv_id, row_number() over (order by s.rnd)::integer,
         (select array_agg(o.id order by random()) from public.question_options o where o.question_version_id = s.qv_id)
  from (
    select aq.question_version_id as qv_id, random() as rnd
    from public.assessment_questions aq
    join public.question_versions qv on qv.id = aq.question_version_id and qv.status = 'published'
    where aq.assessment_version_id = v_version.id
    order by random()
    limit p_question_count
  ) s;

  return private.envelope(private.attempt_payload(v_attempt_id) || jsonb_build_object('resumed', false), p_request_key);
end;
$$;

revoke all on function public.start_configured_attempt_v1(uuid,uuid,integer,integer,boolean) from public,anon;
grant execute on function public.start_configured_attempt_v1(uuid,uuid,integer,integer,boolean) to authenticated;
