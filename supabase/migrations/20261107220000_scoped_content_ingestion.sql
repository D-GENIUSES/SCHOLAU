-- Scoped course content: curriculum RPCs, ingestion by lesson/topic, lecturer publish, student scope.

alter table private.material_ingestion_jobs
  add column if not exists ingestion_scope text not null default 'legacy',
  add column if not exists module_id uuid references public.modules(id),
  add column if not exists lesson_id uuid references public.lessons(id),
  add column if not exists merge_mode text not null default 'fork_from_published',
  add column if not exists proposed_outline jsonb;

alter table private.material_ingestion_jobs drop constraint if exists material_ingestion_jobs_ingestion_scope_check;
alter table private.material_ingestion_jobs add constraint material_ingestion_jobs_ingestion_scope_check
  check (ingestion_scope in ('legacy', 'lesson', 'topic'));

alter table private.material_ingestion_jobs drop constraint if exists material_ingestion_jobs_merge_mode_check;
alter table private.material_ingestion_jobs add constraint material_ingestion_jobs_merge_mode_check
  check (merge_mode in ('append_blocks', 'replace_draft', 'fork_from_published'));

alter table private.material_ingestion_jobs drop constraint if exists material_ingestion_jobs_status_check;
alter table private.material_ingestion_jobs add constraint material_ingestion_jobs_status_check
  check (status in ('pending', 'processing', 'awaiting_outline', 'succeeded', 'failed', 'duplicate_file'));

alter table private.student_material_submissions
  add column if not exists module_id uuid references public.modules(id),
  add column if not exists lesson_id uuid references public.lessons(id),
  add column if not exists ingestion_scope text not null default 'topic';

alter table private.student_material_submissions drop constraint if exists student_material_submissions_ingestion_scope_check;
alter table private.student_material_submissions add constraint student_material_submissions_ingestion_scope_check
  check (ingestion_scope in ('lesson', 'topic'));

create or replace function public.get_lecturer_course_curriculum_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_course public.courses;
  v_modules jsonb;
begin
  if not private.can_manage_ingestion_for_offering(v_uid, p_offering_id) then
    perform private.raise_error('FORBIDDEN');
  end if;
  select * into v_offering from public.course_offerings where id = p_offering_id and status = 'published';
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  select * into v_course from public.courses where id = v_offering.course_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'title', m.title, 'position', m.position,
    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'lesson_id', l.id,
        'position', l.position,
        'title', coalesce(lv.title, 'Untitled lesson'),
        'objective', coalesce(lv.objective, ''),
        'version_id', lv.id,
        'version', lv.version,
        'version_status', lv.status,
        'estimated_minutes', coalesce(lv.estimated_minutes, 5),
        'ready', (
          exists(select 1 from jsonb_array_elements(lv.blocks) b where b->>'type'='worked_example'
            or (b->>'type'='callout' and b->>'tone'='example'))
          and exists(select 1 from jsonb_array_elements(lv.blocks) b where b->>'type'='checkpoint')
          and (select count(*) from public.questions q
            join public.question_versions qv on qv.question_id=q.id
            where q.lesson_id=l.id and q.pool='learning' and qv.status in ('draft','published')
              and (array['review','practice']::text[] && qv.usage))::integer >= 3
          and coalesce(lv.editorial_status,'') is distinct from 'flagged'
        ),
        'has_published', exists(
          select 1 from public.lesson_versions pv where pv.lesson_id=l.id and pv.status='published')
      ) order by l.position)
      from public.lessons l
      cross join lateral (
        select v.* from public.lesson_versions v
        where v.lesson_id=l.id and v.status in ('draft','published')
        order by v.version desc limit 1
      ) lv
      where l.module_id=m.id
    ), '[]'::jsonb)
  ) order by m.position), '[]'::jsonb) into v_modules
  from public.modules m where m.course_id = v_offering.course_id;

  return private.envelope(jsonb_build_object(
    'offering_id', v_offering.id,
    'course', jsonb_build_object('id', v_course.id, 'code', v_course.code, 'title', v_course.title),
    'modules', v_modules
  ));
end;
$$;

create or replace function public.get_enrolled_course_curriculum_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_course public.courses;
  v_modules jsonb;
begin
  v_offering := private.require_offering_enrollment(v_uid, p_offering_id);
  select * into v_course from public.courses where id = v_offering.course_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'title', m.title, 'position', m.position,
    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'lesson_id', l.id,
        'position', l.position,
        'title', coalesce(lv.title, 'Lesson ' || l.position::text)
      ) order by l.position)
      from public.lessons l
      left join lateral (
        select v.title from public.lesson_versions v
        where v.lesson_id=l.id and v.status='published' order by v.version desc limit 1
      ) lv on true
      where l.module_id=m.id
    ), '[]'::jsonb)
  ) order by m.position), '[]'::jsonb) into v_modules
  from public.modules m where m.course_id = v_offering.course_id;

  return private.envelope(jsonb_build_object(
    'offering_id', v_offering.id,
    'course', jsonb_build_object('id', v_course.id, 'code', v_course.code, 'title', v_course.title),
    'modules', v_modules
  ));
end;
$$;

create or replace function public.lecturer_update_module_title_v1(p_module_id uuid, p_title text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_module public.modules;
  v_ok boolean := false;
begin
  select * into v_module from public.modules where id = p_module_id;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if length(btrim(coalesce(p_title,''))) not between 1 and 200 then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  select exists(
    select 1 from public.course_offerings o
    where o.course_id = v_module.course_id and o.status = 'published'
      and private.can_manage_ingestion_for_offering(v_uid, o.id)
  ) into v_ok;
  if not v_ok then perform private.raise_error('FORBIDDEN'); end if;
  update public.modules set title = btrim(p_title) where id = p_module_id;
  return private.envelope(jsonb_build_object('id', p_module_id, 'title', btrim(p_title)));
end;
$$;

create or replace function private.lesson_version_ready_for_publish(p_lesson_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lessons l
    cross join lateral (
      select v.* from public.lesson_versions v
      where v.lesson_id=l.id and v.status in ('draft','published')
      order by v.version desc limit 1
    ) lv
    where l.id = p_lesson_id
      and exists(select 1 from jsonb_array_elements(lv.blocks) b
        where b->>'type'='worked_example' or (b->>'type'='callout' and b->>'tone'='example'))
      and exists(select 1 from jsonb_array_elements(lv.blocks) b where b->>'type'='checkpoint')
      and (select count(*) from public.questions q
        join public.question_versions qv on qv.question_id=q.id
        where q.lesson_id=l.id and q.pool='learning' and qv.status in ('draft','published')
          and (array['review','practice']::text[] && qv.usage)) >= 3
      and coalesce(lv.editorial_status,'') is distinct from 'flagged'
  );
$$;

create or replace function public.lecturer_publish_lesson_v1(
  p_offering_id uuid, p_lesson_version_id uuid, p_request_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_lv public.lesson_versions;
  v_lesson public.lessons;
  v_offering public.course_offerings;
  v_is_admin boolean;
  v_block_errors text[];
begin
  perform private.require_request_key(p_request_key);
  if not private.can_manage_ingestion_for_offering(v_uid, p_offering_id) then
    perform private.raise_error('FORBIDDEN');
  end if;
  select * into v_offering from public.course_offerings where id = p_offering_id and status = 'published';
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  select * into v_lv from public.lesson_versions where id = p_lesson_version_id for update;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  select * into v_lesson from public.lessons where id = v_lv.lesson_id;
  if v_lesson.course_id <> v_offering.course_id then perform private.raise_error('VALIDATION_FAILED'); end if;
  if v_lv.status <> 'draft' then perform private.raise_error('INVALID_STATE'); end if;

  v_is_admin := exists(select 1 from public.user_roles r where r.user_id = v_uid and r.role = 'admin');
  if not v_is_admin and not private.lesson_version_ready_for_publish(v_lesson.id) then
    perform private.raise_error('VALIDATION_FAILED', 'Lesson is not ready to publish.');
  end if;
  v_block_errors := private.validate_lesson_blocks(v_lv.blocks);
  if cardinality(v_block_errors) > 0 then
    perform private.raise_error('VALIDATION_FAILED', array_to_string(v_block_errors, '; '));
  end if;
  if coalesce(length(btrim(v_lv.source_reference)), 0) = 0 then
    perform private.raise_error('VALIDATION_FAILED', 'Source reference is required.');
  end if;

  perform set_config('scholau.allow_publish', 'on', true);
  update public.lesson_versions
     set status = 'retired', retired_at = now(), retired_by = v_uid, retired_reason = 'superseded'
   where lesson_id = v_lv.lesson_id and status = 'published';
  update public.lesson_versions
     set status = 'published', reviewed_by = coalesce(reviewed_by, v_uid), published_at = now()
   where id = p_lesson_version_id;
  perform set_config('scholau.allow_publish', 'off', true);

  update public.question_versions qv
    set status = 'published', reviewed_by = coalesce(reviewed_by, v_uid), published_at = now()
  from public.questions q
  where q.id = qv.question_id and q.lesson_id = v_lesson.id and q.pool = 'learning'
    and qv.status = 'draft';

  perform private.audit(v_uid, 'lecturer_publish', 'lesson_version', p_lesson_version_id, p_request_key);
  return private.envelope(jsonb_build_object(
    'entity_type', 'lesson_version', 'id', p_lesson_version_id, 'status', 'published'), p_request_key);
end;
$$;

create or replace function public.create_material_ingestion_job_v1(
  p_offering_id uuid,
  p_sha256 text,
  p_filename text,
  p_object_key text,
  p_bytes bigint,
  p_mime_type text,
  p_topic_mode text,
  p_module_title text,
  p_module_position integer,
  p_confirmed_outline jsonb,
  p_battle_mix jsonb,
  p_force_reprocess boolean,
  p_request_key uuid,
  p_ingestion_scope text default 'legacy',
  p_module_id uuid default null,
  p_lesson_id uuid default null,
  p_merge_mode text default 'fork_from_published'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_dup private.material_ingestion_jobs;
  v_job private.material_ingestion_jobs;
  v_module public.modules;
  v_lesson public.lessons;
  v_scope text := coalesce(nullif(btrim(p_ingestion_scope), ''), 'legacy');
begin
  if not private.can_manage_ingestion_for_offering(v_uid, p_offering_id) then
    perform private.raise_error('FORBIDDEN');
  end if;
  select * into v_offering from public.course_offerings where id = p_offering_id and status = 'published';
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if coalesce(p_sha256,'') !~ '^[a-f0-9]{64}$' then perform private.raise_error('VALIDATION_FAILED'); end if;
  if coalesce(p_object_key,'') !~ '^course-materials/[a-f0-9]{64}\.(pdf|docx|pptx|txt|jpg|jpeg|png|webp)$' then
    perform private.raise_error('VALIDATION_FAILED', 'Invalid object key.');
  end if;
  if v_scope not in ('legacy','lesson','topic') then perform private.raise_error('VALIDATION_FAILED'); end if;
  if coalesce(p_merge_mode, 'fork_from_published') not in ('append_blocks','replace_draft','fork_from_published') then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  perform private.require_request_key(p_request_key);

  if v_scope = 'lesson' then
    if p_lesson_id is null then perform private.raise_error('VALIDATION_FAILED', 'lesson_id required'); end if;
    select l.* into v_lesson from public.lessons l where l.id = p_lesson_id and l.course_id = v_offering.course_id;
    if not found then perform private.raise_error('NOT_FOUND'); end if;
    select * into v_module from public.modules where id = v_lesson.module_id;
    p_module_id := v_module.id;
    p_module_title := v_module.title;
    p_module_position := v_module.position;
  elsif v_scope = 'topic' then
    if p_module_id is null then perform private.raise_error('VALIDATION_FAILED', 'module_id required'); end if;
    select * into v_module from public.modules where id = p_module_id and course_id = v_offering.course_id;
    if not found then perform private.raise_error('NOT_FOUND'); end if;
    p_module_title := v_module.title;
    p_module_position := v_module.position;
  end if;

  if coalesce(p_force_reprocess, false) = false and v_scope = 'legacy' then
    select * into v_dup from private.material_ingestion_jobs
      where course_id = v_offering.course_id and sha256 = p_sha256 and status = 'succeeded' limit 1;
    if found then
      return private.envelope(jsonb_build_object(
        'duplicate_file', true, 'job_id', v_dup.id, 'message', 'This file was already processed for this course.'));
    end if;
  end if;

  insert into private.course_materials (course_id, sha256, object_key, filename, bytes, published)
    values (v_offering.course_id, p_sha256, p_object_key, p_filename, p_bytes, false)
  on conflict (course_id, sha256) do update set object_key = excluded.object_key, filename = excluded.filename,
    bytes = excluded.bytes, updated_at = now();

  insert into private.material_ingestion_jobs (
    offering_id, course_id, uploaded_by, sha256, filename, object_key, bytes, mime_type,
    topic_mode, module_title, module_position, confirmed_outline, battle_mix, force_reprocess, request_key,
    ingestion_scope, module_id, lesson_id, merge_mode
  ) values (
    p_offering_id, v_offering.course_id, v_uid, p_sha256, p_filename, p_object_key, p_bytes, p_mime_type,
  case when v_scope = 'topic' then 'existing_module' else coalesce(p_topic_mode, 'existing_module') end,
    nullif(btrim(p_module_title), ''), p_module_position, p_confirmed_outline,
    coalesce(p_battle_mix, '{"standard":0.3,"worked_solution":0.3,"fill_in_gap":0.4}'::jsonb),
    coalesce(p_force_reprocess, false), p_request_key,
    v_scope, p_module_id, p_lesson_id, coalesce(p_merge_mode, 'fork_from_published')
  ) returning * into v_job;

  perform private.wake_ingestion_worker();
  return private.envelope(jsonb_build_object('job_id', v_job.id, 'duplicate_file', false, 'status', v_job.status));
end;
$$;

create or replace function public.confirm_material_ingestion_outline_v1(
  p_job_id uuid, p_outline jsonb, p_request_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_job private.material_ingestion_jobs;
begin
  perform private.require_request_key(p_request_key);
  select * into v_job from private.material_ingestion_jobs where id = p_job_id for update;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if not private.can_manage_ingestion_for_offering(v_uid, v_job.offering_id) then
    perform private.raise_error('FORBIDDEN');
  end if;
  if v_job.status <> 'awaiting_outline' then perform private.raise_error('INVALID_STATE'); end if;
  if p_outline is null or jsonb_typeof(p_outline) <> 'object'
    or jsonb_array_length(coalesce(p_outline->'segments', '[]'::jsonb)) < 1
    or jsonb_array_length(coalesce(p_outline->'segments', '[]'::jsonb)) > 12 then
    perform private.raise_error('VALIDATION_FAILED', 'Outline must have 1–12 segments.');
  end if;
  update private.material_ingestion_jobs
    set confirmed_outline = p_outline, status = 'pending', updated_at = now()
  where id = p_job_id;
  perform private.wake_ingestion_worker();
  return private.envelope(jsonb_build_object('job_id', p_job_id, 'status', 'pending'), p_request_key);
end;
$$;

create or replace function public.get_material_ingestion_job_v1(p_job_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_job private.material_ingestion_jobs;
begin
  select * into v_job from private.material_ingestion_jobs where id = p_job_id;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if v_job.uploaded_by <> v_uid
    and not exists(select 1 from public.user_roles r where r.user_id = v_uid and r.role = 'admin')
    and not private.can_manage_ingestion_for_offering(v_uid, v_job.offering_id) then
    perform private.raise_error('FORBIDDEN');
  end if;
  return private.envelope(jsonb_build_object(
    'id', v_job.id, 'status', v_job.status, 'filename', v_job.filename, 'sha256', v_job.sha256,
    'stats', v_job.stats, 'error', v_job.error, 'created_at', v_job.created_at, 'updated_at', v_job.updated_at,
    'ingestion_scope', v_job.ingestion_scope, 'module_id', v_job.module_id, 'lesson_id', v_job.lesson_id,
    'merge_mode', v_job.merge_mode, 'proposed_outline', v_job.proposed_outline,
    'confirmed_outline', v_job.confirmed_outline, 'offering_id', v_job.offering_id));
end;
$$;

create or replace function public.finish_material_ingestion_job_v1(
  p_job_id uuid, p_status text, p_stats jsonb, p_error text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('role', true) <> 'service_role' then perform private.raise_error('FORBIDDEN'); end if;
  if p_status not in ('succeeded', 'failed', 'duplicate_file', 'awaiting_outline') then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  update private.material_ingestion_jobs set status = p_status, stats = coalesce(p_stats, '{}'::jsonb),
    error = nullif(btrim(p_error), ''),
    proposed_outline = case when p_stats ? 'proposed_outline' then p_stats->'proposed_outline' else proposed_outline end,
    lease_owner = null, lease_until = null, updated_at = now()
  where id = p_job_id;
end;
$$;

create or replace function public.submit_student_material_v1(
  p_offering_id uuid, p_filename text, p_sha256 text, p_object_key text,
  p_mime_type text, p_bytes bigint, p_notes text,
  p_module_id uuid default null, p_lesson_id uuid default null, p_ingestion_scope text default 'topic'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_id uuid; v_scope text := coalesce(nullif(btrim(p_ingestion_scope),''), 'topic');
begin
  perform public.can_submit_student_material_v1(p_offering_id);
  if v_scope not in ('lesson','topic') then perform private.raise_error('VALIDATION_FAILED'); end if;
  if v_scope = 'lesson' and p_lesson_id is null then perform private.raise_error('VALIDATION_FAILED'); end if;
  if v_scope = 'topic' and p_module_id is null then perform private.raise_error('VALIDATION_FAILED'); end if;
  if p_filename is null or length(btrim(p_filename)) not between 1 and 240
    or p_sha256 !~ '^[a-f0-9]{64}$'
    or p_object_key !~ '^course-materials/[a-f0-9]{64}\.(pdf|docx|pptx|txt|jpg|jpeg|png|webp)$'
    or p_object_key not like ('course-materials/' || p_sha256 || '.%')
    or p_bytes not between 1 and 52428800
    or p_mime_type not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain',
      'image/jpeg','image/png','image/webp')
    or length(coalesce(p_notes,'')) > 500 then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  if p_module_id is not null and not exists(
    select 1 from public.modules m join public.course_offerings o on o.course_id=m.course_id
    where m.id=p_module_id and o.id=p_offering_id) then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  if p_lesson_id is not null and not exists(
    select 1 from public.lessons l join public.course_offerings o on o.course_id=l.course_id
    where l.id=p_lesson_id and o.id=p_offering_id) then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('student-material:' || v_uid::text,0));
  if (select count(*) from private.student_material_submissions
      where student_id=v_uid and status='pending') >= 5 then
    perform private.raise_error('VALIDATION_FAILED','You have five materials awaiting review.');
  end if;
  insert into private.student_material_submissions
     (offering_id,student_id,filename,sha256,object_key,mime_type,bytes,notes,module_id,lesson_id,ingestion_scope)
  values(p_offering_id,v_uid,btrim(p_filename),p_sha256,p_object_key,p_mime_type,p_bytes,coalesce(p_notes,''),
    p_module_id,p_lesson_id,v_scope)
  returning id into v_id;
  return private.envelope(jsonb_build_object('id',v_id,'status','pending'));
end;
$$;

create or replace function public.review_student_material_v1(
  p_submission_id uuid, p_decision text, p_note text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_item private.student_material_submissions; v_job jsonb;
  v_scope text; v_req uuid := gen_random_uuid();
begin
  select * into v_item from private.student_material_submissions where id=p_submission_id for update;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if not private.can_manage_ingestion_for_offering(v_uid,v_item.offering_id)
     then perform private.raise_error('FORBIDDEN'); end if;
  if v_item.status <> 'pending' or p_decision not in ('approved','rejected')
    or length(coalesce(p_note,'')) > 500 then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  if p_decision='approved' and v_item.student_id=v_uid
    then perform private.raise_error('FORBIDDEN'); end if;
  if p_decision='approved' then
    v_scope := v_item.ingestion_scope;
    v_job := public.create_material_ingestion_job_v1(
      v_item.offering_id,v_item.sha256,v_item.filename,v_item.object_key,
      v_item.bytes,v_item.mime_type,'existing_module',null,null,null,
      '{"standard":0.3,"worked_solution":0.3,"fill_in_gap":0.4}'::jsonb,false,v_req,
      v_scope, v_item.module_id, v_item.lesson_id, 'fork_from_published');
  end if;
  update private.student_material_submissions
    set status=p_decision,reviewed_by=v_uid,reviewed_at=now(),
      reviewer_note=nullif(btrim(coalesce(p_note,'')),''),
      ingestion_job_id=case when p_decision='approved' then (v_job->>'job_id')::uuid else null end
  where id=p_submission_id;
  return private.envelope(jsonb_build_object('id',p_submission_id,'status',p_decision,
    'job_id',case when p_decision='approved' then v_job->>'job_id' else null end));
end;
$$;

revoke all on function public.get_lecturer_course_curriculum_v1(uuid),
  public.get_enrolled_course_curriculum_v1(uuid),
  public.lecturer_update_module_title_v1(uuid,text),
  public.lecturer_publish_lesson_v1(uuid,uuid,uuid),
  public.confirm_material_ingestion_outline_v1(uuid,jsonb,uuid)
  from public,anon;
grant execute on function public.get_lecturer_course_curriculum_v1(uuid),
  public.get_enrolled_course_curriculum_v1(uuid),
  public.lecturer_update_module_title_v1(uuid,text),
  public.lecturer_publish_lesson_v1(uuid,uuid,uuid),
  public.confirm_material_ingestion_outline_v1(uuid,jsonb,uuid)
  to authenticated;

grant execute on function public.create_material_ingestion_job_v1(
  uuid,text,text,text,bigint,text,text,text,integer,jsonb,jsonb,boolean,uuid,text,uuid,uuid,text
) to authenticated;

grant execute on function public.submit_student_material_v1(
  uuid,text,text,text,text,bigint,text,uuid,uuid,text
) to authenticated;
