-- Let assigned course staff review shared source files, and retire student upload APIs.
create or replace function public.get_course_materials_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_staff boolean;
begin
  v_staff := private.can_manage_ingestion_for_offering(v_uid, p_offering_id);
  if v_staff then
    select * into v_offering from public.course_offerings where id = p_offering_id;
    if not found then perform private.raise_error('NOT_FOUND'); end if;
  else
    v_offering := private.require_offering_enrollment(v_uid, p_offering_id);
  end if;

  return private.envelope(jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object('id', m.sha256, 'filename', m.filename, 'bytes', m.bytes) order by m.filename, m.sha256)
    from private.course_materials m
    where m.course_id = v_offering.course_id and (v_staff or m.published)
  ), '[]'::jsonb)));
end;
$$;

create or replace function public.get_course_material_access_v1(p_offering_id uuid, p_sha256 text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_material private.course_materials;
  v_staff boolean;
begin
  v_staff := private.can_manage_ingestion_for_offering(v_uid, p_offering_id);
  if v_staff then
    select * into v_offering from public.course_offerings where id = p_offering_id;
    if not found then perform private.raise_error('NOT_FOUND'); end if;
  else
    v_offering := private.require_offering_enrollment(v_uid, p_offering_id);
  end if;
  select * into v_material from private.course_materials
  where course_id = v_offering.course_id and sha256 = p_sha256 and (v_staff or published);
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  return private.envelope(jsonb_build_object('object_key', v_material.object_key, 'filename', v_material.filename));
end;
$$;

-- Course source text has already been extracted by the material ingestion pipeline.
-- This staff-only RPC lists files and returns bounded extracted text for selected files.
create or replace function public.get_lecturer_quiz_generation_materials_v1(
  p_offering_id uuid,
  p_sha256s text[] default '{}'
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_course public.courses;
  v_hashes text[] := coalesce(p_sha256s, '{}');
  v_items jsonb;
begin
  if not private.can_manage_ingestion_for_offering(v_uid, p_offering_id) then
    perform private.raise_error('FORBIDDEN');
  end if;
  select * into v_offering from public.course_offerings where id = p_offering_id and status = 'published';
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  select * into v_course from public.courses where id = v_offering.course_id;

  if cardinality(v_hashes) = 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.sha256,
      'filename', m.filename,
      'ready', exists (
        select 1 from private.material_ingestion_jobs j
        join private.material_ingestion_evidence e on e.job_id = j.id
        where j.course_id = v_offering.course_id and j.sha256 = m.sha256 and j.status = 'succeeded'
          and length(trim(coalesce(e.source_text, ''))) > 0
      )
    ) order by m.filename, m.sha256), '[]'::jsonb)
    into v_items
    from private.course_materials m where m.course_id = v_offering.course_id;
    return private.envelope(jsonb_build_object('course_code', v_course.code, 'items', v_items));
  end if;

  if exists (select 1 from unnest(v_hashes) h where h !~ '^[a-f0-9]{64}$') then
    perform private.raise_error('VALIDATION_FAILED', 'Choose valid course materials.');
  end if;
  if exists (
    select 1 from unnest(v_hashes) h
    where not exists (select 1 from private.course_materials m where m.course_id = v_offering.course_id and m.sha256 = h)
  ) then perform private.raise_error('VALIDATION_FAILED', 'Choose materials from this course.'); end if;
  if exists (
    select 1 from unnest(v_hashes) h
    where not exists (
      select 1 from private.material_ingestion_jobs j
      join private.material_ingestion_evidence e on e.job_id = j.id
      where j.course_id = v_offering.course_id and j.sha256 = h and j.status = 'succeeded'
        and length(trim(coalesce(e.source_text, ''))) > 0
    )
  ) then perform private.raise_error('VALIDATION_FAILED', 'Process each selected material before generating questions.'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'module_title', 'Uploaded material',
    'lesson_title', m.filename,
    'objective', '',
    'text', left(x.source_text, 12000)
  ) order by m.filename, m.sha256), '[]'::jsonb)
  into v_items
  from private.course_materials m
  join lateral (
    select string_agg(e.source_text, E'\n' order by e.created_at, e.id) as source_text
    from private.material_ingestion_jobs j
    join private.material_ingestion_evidence e on e.job_id = j.id
    where j.course_id = v_offering.course_id and j.sha256 = m.sha256 and j.status = 'succeeded'
      and length(trim(coalesce(e.source_text, ''))) > 0
  ) x on x.source_text is not null
  where m.course_id = v_offering.course_id and m.sha256 = any(v_hashes);

  if v_items = '[]'::jsonb then
    perform private.raise_error('VALIDATION_FAILED', 'Process the selected material before generating questions.');
  end if;
  return private.envelope(jsonb_build_object('course_code', v_course.code, 'sources', v_items));
end;
$$;

-- Student material submissions are retired. Keep the review data for existing records.
create or replace function public.can_submit_student_material_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_user();
  perform private.raise_error('FORBIDDEN', 'Only lecturers and administrators can upload course materials.');
  return private.envelope(jsonb_build_object('allowed', false));
end;
$$;
revoke all on function public.submit_student_material_v1(uuid,text,text,text,text,bigint,text),
  public.submit_student_material_v1(uuid,text,text,text,text,bigint,text,uuid,uuid,text)
  from public, anon, authenticated;

-- Video suggestions are now restricted to course staff at the database boundary as well as the UI.
create or replace function private.require_lesson_video_manager()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_course uuid;
begin
  select course_id into v_course from public.lessons where id = new.lesson_id;
  if v_course is null or not private.can_manage_lesson_videos(auth.uid(), v_course) then
    perform private.raise_error('FORBIDDEN', 'Only lecturers and administrators can add lesson videos.');
  end if;
  return new;
end;
$$;
revoke all on function private.require_lesson_video_manager() from public, anon, authenticated;
drop trigger if exists lesson_video_staff_only on public.lesson_videos;
create trigger lesson_video_staff_only before insert on public.lesson_videos
for each row execute function private.require_lesson_video_manager();

revoke all on function public.get_lecturer_quiz_generation_materials_v1(uuid,text[]) from public, anon;
grant execute on function public.get_lecturer_quiz_generation_materials_v1(uuid,text[]) to authenticated;
