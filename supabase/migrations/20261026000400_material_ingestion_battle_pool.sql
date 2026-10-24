-- Fill-in-gap battles in pools, payloads, admin question review, ingestion dedup helpers.

create or replace function private.battle_pool_size(p_course_id uuid) returns integer
language sql stable set search_path = '' as $$
  select count(*)::integer from public.questions q join public.question_versions v on v.question_id = q.id
  where q.course_id = p_course_id and q.pool = 'battle' and v.status = 'published' and 'battle' = any (v.usage)
    and (
      v.answer_format = 'fill_in_gap'
      or (select count(*) from public.question_options o where o.question_version_id = v.id) = 4
    );
$$;

create or replace function private.schedule_battle(p_battle_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare b public.battles; r public.battle_rules; v_start timestamptz; v_count integer; v_short boolean;
begin
  select * into b from public.battles where id = p_battle_id for update;
  select * into r from public.battle_rules where id = b.rules_id;
  v_start := now() + make_interval(secs => r.countdown_seconds);
  select exists(
    select 1 from public.battle_courses bc join public.course_offerings o on o.id = bc.offering_id
    where bc.battle_id = b.id and private.battle_pool_size(o.course_id) <
      b.round_count / (select count(*) from public.battle_courses where battle_id = b.id)
      + case when bc.position <= b.round_count % (select count(*) from public.battle_courses where battle_id = b.id) then 1 else 0 end
  ) into v_short;
  if v_short then perform private.cancel_battle(b.id, 'content_unavailable'); return false; end if;
  with scope as (
    select o.course_id, bc.position, b.round_count / count(*) over ()::integer +
      case when bc.position <= b.round_count % count(*) over ()::integer then 1 else 0 end as needed
    from public.battle_courses bc join public.course_offerings o on o.id = bc.offering_id where bc.battle_id = b.id
  ), picked as (
    select qv.id, qv.answer_format, private.battle_question_seconds(qv.id) as seconds,
      private.battle_reading_seconds(qv.id) as reading_seconds
    from scope s cross join lateral (
      select v.id, v.answer_format from public.questions q join public.question_versions v on v.question_id = q.id
      where q.course_id = s.course_id and q.pool = 'battle' and v.status = 'published' and 'battle' = any (v.usage)
        and (
          v.answer_format = 'fill_in_gap'
          or (select count(*) from public.question_options opt where opt.question_version_id = v.id) = 4
        )
      order by random() limit s.needed
    ) qv
  ), shuffled as (
    select *, row_number() over (order by random())::integer as position from picked
  ), timed as (
    select *, coalesce(sum(seconds + reading_seconds) over (order by position rows between unbounded preceding and 1 preceding), 0)::integer as offset_seconds
    from shuffled
  )
  insert into public.battle_questions (battle_id, position, question_version_id, reading_at, opened_at, deadline, option_order)
  select b.id, t.position, t.id,
    v_start + make_interval(secs => t.offset_seconds),
    v_start + make_interval(secs => t.offset_seconds + t.reading_seconds),
    v_start + make_interval(secs => t.offset_seconds + t.reading_seconds + t.seconds),
    case when t.answer_format = 'fill_in_gap' then '{}'::uuid[]
      else (select array_agg(opt.id order by random()) from public.question_options opt where opt.question_version_id = t.id)
    end
  from timed t;
  get diagnostics v_count = row_count;
  if v_count <> b.round_count then
    delete from public.battle_questions where battle_id = b.id;
    perform private.cancel_battle(b.id, 'content_unavailable'); return false;
  end if;
  update public.battles set state = 'countdown', starts_at = v_start,
    ends_at = (select max(deadline) from public.battle_questions where battle_id = b.id), revision = revision + 1
    where id = b.id returning * into b;
  update public.battle_participants set activated_at = now() where battle_id = b.id;
  update private.battle_slots set expires_at = b.ends_at + interval '10 minutes' where battle_id = b.id;
  perform private.battle_event(b.id);
  return true;
end;
$$;

create or replace function public.claim_material_ingestion_jobs_v1(p_limit integer default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_jobs jsonb := '[]'::jsonb;
  v_job private.material_ingestion_jobs;
  v_n integer := greatest(1, least(coalesce(p_limit, 1), 5));
begin
  if current_setting('role', true) <> 'service_role' then perform private.raise_error('FORBIDDEN'); end if;
  for v_job in
    select * from private.material_ingestion_jobs
    where status = 'pending' and (lease_until is null or lease_until < now())
    order by created_at for update skip locked limit v_n
  loop
    update private.material_ingestion_jobs set status = 'processing', lease_owner = 'worker',
      lease_until = now() + interval '10 minutes', attempts = attempts + 1, updated_at = now()
    where id = v_job.id
    returning * into v_job;
    v_jobs := v_jobs || to_jsonb(v_job);
  end loop;
  return jsonb_build_object('jobs', v_jobs);
end;
$$;

create or replace function public.service_check_ingestion_content_v1(
  p_course_id uuid, p_fingerprint text, p_logical_keys text[]
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_existing text[];
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true)) <> 'service_role'
     and current_setting('role', true) <> 'service_role' then
    perform private.raise_error('FORBIDDEN');
  end if;
  select coalesce(array_agg(distinct q.logical_key), '{}') into v_existing
  from public.questions q
  where q.course_id = p_course_id and q.logical_key = any (coalesce(p_logical_keys, '{}'));
  return jsonb_build_object(
    'duplicate_fingerprint', exists(
      select 1 from private.material_ingestion_evidence e
      join private.material_ingestion_jobs j on j.id = e.job_id
      where j.course_id = p_course_id and e.content_fingerprint = p_fingerprint
    ),
    'existing_logical_keys', coalesce(to_jsonb(v_existing), '[]'::jsonb)
  );
end;
$$;

create or replace function public.service_record_ingestion_evidence_v1(
  p_job_id uuid, p_logical_key text, p_fingerprint text, p_source_reference text, p_source_text text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true)) <> 'service_role'
     and current_setting('role', true) <> 'service_role' then
    perform private.raise_error('FORBIDDEN');
  end if;
  insert into private.material_ingestion_evidence (job_id, logical_key, content_fingerprint, source_reference, source_text)
  values (p_job_id, nullif(btrim(p_logical_key), ''), p_fingerprint, nullif(btrim(p_source_reference), ''), nullif(btrim(p_source_text), ''));
end;
$$;

create or replace function public.admin_get_ingestion_evidence_v1(p_source_reference text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_admin(); v_sha text; v_rows jsonb;
begin
  v_sha := substring(coalesce(p_source_reference, '') from 'SHA-256 ([a-f0-9]{12})');
  if v_sha is null then return private.envelope(jsonb_build_object('items', '[]'::jsonb)); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'content_fingerprint', e.content_fingerprint,
    'logical_key', e.logical_key,
    'source_text', left(coalesce(e.source_text, ''), 400),
    'created_at', e.created_at,
    'job_id', e.job_id
  ) order by e.created_at desc), '[]'::jsonb) into v_rows
  from private.material_ingestion_evidence e
  join private.material_ingestion_jobs j on j.id = e.job_id
  where j.sha256 like v_sha || '%';
  return private.envelope(jsonb_build_object('items', v_rows));
end;
$$;

create or replace function public.admin_get_question_v1(p_question_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_admin(); v_result jsonb;
begin
  select jsonb_build_object(
    'question_id', q.id, 'course_id', q.course_id, 'lesson_id', q.lesson_id, 'pool', q.pool, 'logical_key', q.logical_key,
    'question_version_id', qv.id, 'version', qv.version, 'status', qv.status, 'prompt', qv.prompt,
    'difficulty', qv.difficulty, 'usage', to_jsonb(qv.usage), 'source_reference', qv.source_reference,
    'answer_format', qv.answer_format, 'battle_seconds', qv.battle_seconds, 'battle_reading_seconds', qv.battle_reading_seconds,
    'suggested_answer_seconds', private.battle_question_seconds(qv.id), 'suggested_reading_seconds', private.battle_reading_seconds(qv.id),
    'reviewed_by', qv.reviewed_by, 'published_at', qv.published_at,
    'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'body', o.body, 'position', o.position, 'steps', to_jsonb(o.steps))
      order by o.position), '[]'::jsonb) from public.question_options o where o.question_version_id = qv.id),
    'correct_option_id', k.correct_option_id,
    'gap_answers', k.gap_answers,
    'explanation', k.explanation)
  into v_result
  from public.question_versions qv
  join public.questions q on q.id = qv.question_id
  left join private.question_answer_keys k on k.question_version_id = qv.id
  where qv.id = p_question_version_id;
  if v_result is null then perform private.raise_error('NOT_FOUND'); end if;
  return private.envelope(v_result);
end;
$$;

revoke all on function public.service_check_ingestion_content_v1(uuid,text,text[]),
  public.service_record_ingestion_evidence_v1(uuid,text,text,text,text),
  public.admin_get_ingestion_evidence_v1(text)
  from public, anon, authenticated;
grant execute on function public.service_check_ingestion_content_v1(uuid,text,text[]),
  public.service_record_ingestion_evidence_v1(uuid,text,text,text,text)
  to service_role;
grant execute on function public.admin_get_ingestion_evidence_v1(text) to authenticated;

create or replace function public.admin_get_course_material_object_v1(p_course_id uuid, p_sha256 text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_row private.course_materials;
begin
  perform private.require_admin();
  if coalesce(p_sha256, '') !~ '^[a-f0-9]{64}$' then perform private.raise_error('VALIDATION_FAILED'); end if;
  select * into v_row from private.course_materials where course_id = p_course_id and sha256 = p_sha256;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  return private.envelope(jsonb_build_object('object_key', v_row.object_key, 'filename', v_row.filename, 'bytes', v_row.bytes));
end;
$$;

grant execute on function public.admin_get_course_material_object_v1(uuid, text) to authenticated;

do $$ declare definition text; begin
  select pg_get_functiondef('private.battle_payload(uuid,uuid)'::regprocedure) into definition;
  if definition is null then raise exception 'battle_payload missing'; end if;
  if strpos(definition, '''my_text_answer''') = 0 then
    definition := replace(definition,
      $old$'my_option_id', (select ba.option_id from public.battle_answers ba
                         where ba.battle_id = b.id and ba.user_id = p_user_id and ba.position = cur.position))$old$,
      $new$'my_option_id', (select ba.option_id from public.battle_answers ba
                         where ba.battle_id = b.id and ba.user_id = p_user_id and ba.position = cur.position),
        'my_text_answer', (select ba.text_answer from public.battle_answers ba
                         where ba.battle_id = b.id and ba.user_id = p_user_id and ba.position = cur.position))$new$);
  end if;
  if strpos(definition, 'coalesce((select jsonb_agg(jsonb_build_object(''id'', o.id') = 0 then
    definition := replace(definition,
      $old$'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body,'steps',to_jsonb(o.steps)) order by ord.n)
                    from unnest(cur.option_order) with ordinality as ord(option_id, n)
                    join public.question_options o on o.id = ord.option_id),$old$,
      $new$'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body,'steps',to_jsonb(o.steps)) order by ord.n)
                    from unnest(cur.option_order) with ordinality as ord(option_id, n)
                    join public.question_options o on o.id = ord.option_id), '[]'::jsonb),$new$);
  end if;
  execute definition;
end $$;
