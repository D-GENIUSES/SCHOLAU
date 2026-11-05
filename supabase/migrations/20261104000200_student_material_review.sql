-- Student materials remain private and unprocessed until lecturer/admin approval.
-- Approval queues existing ingestion; generated content remains draft for separate publication review.
create table private.student_material_submissions (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id),
  student_id uuid not null references public.profiles(id),
  filename text not null check (length(filename) between 1 and 240),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  object_key text not null check (object_key ~ '^course-materials/[a-f0-9]{64}\.(pdf|docx|pptx|txt|jpg|jpeg|png|webp)$'),
  mime_type text not null,
  bytes bigint not null check (bytes between 1 and 52428800),
  notes text not null default '' check (length(notes) <= 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  reviewer_note text check (length(reviewer_note) <= 500),
  ingestion_job_id uuid references private.material_ingestion_jobs(id),
  submitted_at timestamptz not null default now()
);
create index student_materials_offering_status on private.student_material_submissions(offering_id,status,submitted_at desc);
create index student_materials_student on private.student_material_submissions(student_id,submitted_at desc);
alter table private.student_material_submissions enable row level security;
revoke all on private.student_material_submissions from public, anon, authenticated;

create function public.can_submit_student_material_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_user();
begin
  if not exists(
    select 1 from public.enrollments e
    join public.course_offerings o on o.id=e.offering_id
    where e.user_id=v_uid and e.ended_at is null
      and o.id=p_offering_id and o.status='published'
  ) then perform private.raise_error('NOT_ENROLLED'); end if;
  if (select count(*) from private.student_material_submissions
      where student_id=v_uid and status='pending') >= 5 then
    perform private.raise_error('VALIDATION_FAILED','You already have five materials awaiting review.');
  end if;
  return private.envelope(jsonb_build_object('allowed',true));
end;
$$;

create function public.submit_student_material_v1(
  p_offering_id uuid, p_filename text, p_sha256 text, p_object_key text,
  p_mime_type text, p_bytes bigint, p_notes text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_id uuid;
begin
  perform public.can_submit_student_material_v1(p_offering_id);
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
  perform pg_advisory_xact_lock(hashtextextended('student-material:' || v_uid::text,0));
  if (select count(*) from private.student_material_submissions
      where student_id=v_uid and status='pending') >= 5 then
    perform private.raise_error('VALIDATION_FAILED','You have five materials awaiting review.');
  end if;
  insert into private.student_material_submissions
     (offering_id,student_id,filename,sha256,object_key,mime_type,bytes,notes)
  values(p_offering_id,v_uid,btrim(p_filename),p_sha256,p_object_key,p_mime_type,p_bytes,coalesce(p_notes,''))
  returning id into v_id;
  return private.envelope(jsonb_build_object('id',v_id,'status','pending'));
end;
$$;

create function public.list_student_materials_v1(p_offering_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_is_admin boolean; v_items jsonb;
begin
  v_is_admin := exists(select 1 from public.user_roles where user_id=v_uid and role='admin');
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',s.id,'offering_id',s.offering_id,'course_code',c.code,
      'filename',s.filename,'notes',s.notes,'status',s.status,
      'submitted_at',s.submitted_at,'student_name',pr.display_name,
      'reviewer_note',s.reviewer_note,'job_id',s.ingestion_job_id
    ) order by s.submitted_at desc), '[]'::jsonb) into v_items
  from private.student_material_submissions s
  join public.course_offerings o on o.id=s.offering_id
  join public.courses c on c.id=o.course_id
  join public.profiles pr on pr.id=s.student_id
  where (p_offering_id is null or s.offering_id=p_offering_id)
    and (s.student_id=v_uid or v_is_admin
      or exists(select 1 from public.lecturer_course_assignments a
        where a.user_id=v_uid and a.offering_id=s.offering_id
        and private.can_manage_ingestion_for_offering(v_uid,s.offering_id)));
  return private.envelope(jsonb_build_object('items',v_items));
end;
$$;

create function public.review_student_material_v1(
  p_submission_id uuid, p_decision text, p_note text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_item private.student_material_submissions; v_job jsonb;
begin
  select * into v_item from private.student_material_submissions where id=p_submission_id for update;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if not private.can_manage_ingestion_for_offering(v_uid,v_item.offering_id)
     then perform private.raise_error('FORBIDDEN'); end if;
  if v_item.status <> 'pending' or p_decision not in ('approved','rejected')
    or length(coalesce(p_note,'')) > 500 then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  -- Never allow the submitter to self-approve.
  if p_decision='approved' and v_item.student_id=v_uid
    then perform private.raise_error('FORBIDDEN'); end if;
  if p_decision='approved' then
    v_job := public.create_material_ingestion_job_v1(
      v_item.offering_id,v_item.sha256,v_item.filename,v_item.object_key,
      v_item.bytes,v_item.mime_type,'auto_segment',null,null,null,
      '{"standard":0.3,"worked_solution":0.3,"fill_in_gap":0.4}'::jsonb,false,gen_random_uuid());
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

revoke all on function public.can_submit_student_material_v1(uuid),
  public.submit_student_material_v1(uuid,text,text,text,text,bigint,text),
  public.list_student_materials_v1(uuid),
  public.review_student_material_v1(uuid,text,text) from public,anon;
grant execute on function public.can_submit_student_material_v1(uuid),
  public.submit_student_material_v1(uuid,text,text,text,text,bigint,text),
  public.list_student_materials_v1(uuid),
  public.review_student_material_v1(uuid,text,text) to authenticated;