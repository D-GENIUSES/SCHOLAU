-- A student RPC must not be able to claim an arbitrary private object by hash.
-- Only the authenticated server upload path issues a short-lived receipt.
begin;
create table private.student_material_upload_receipts (
  student_id uuid not null references public.profiles(id) on delete cascade,
  offering_id uuid not null references public.course_offerings(id),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  object_key text not null,
  mime_type text not null,
  bytes bigint not null check (bytes between 1 and 52428800),
  expires_at timestamptz not null default now()+interval '1 hour',
  primary key(student_id,offering_id,sha256)
);
alter table private.student_material_upload_receipts enable row level security;
revoke all on private.student_material_upload_receipts from public,anon,authenticated;

create function public.register_student_material_upload_v1(
  p_student_id uuid,p_offering_id uuid,p_sha256 text,p_object_key text,p_mime_type text,p_bytes bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.enrollments e
    join public.course_offerings o on o.id=e.offering_id
    join public.profiles p on p.id=e.user_id
    where e.user_id=p_student_id and e.offering_id=p_offering_id and e.ended_at is null
      and o.status='published' and p.deactivated_at is null)
    or exists(select 1 from private.pending_registrations where user_id=p_student_id)
  then perform private.raise_error('FORBIDDEN'); end if;
  if p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'
    or p_object_key is null or p_object_key !~ '^course-materials/[a-f0-9]{64}\.(pdf|docx|pptx|txt|jpg|jpeg|png|webp)$'
    or p_object_key not like ('course-materials/'||p_sha256||'.%')
    or p_bytes is null or p_bytes not between 1 and 52428800
    or p_mime_type is null or p_mime_type not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','image/jpeg','image/png','image/webp')
  then perform private.raise_error('VALIDATION_FAILED'); end if;
  delete from private.student_material_upload_receipts where expires_at<=now();
  insert into private.student_material_upload_receipts(student_id,offering_id,sha256,object_key,mime_type,bytes)
  values(p_student_id,p_offering_id,p_sha256,p_object_key,p_mime_type,p_bytes)
  on conflict(student_id,offering_id,sha256) do update
    set object_key=excluded.object_key,mime_type=excluded.mime_type,bytes=excluded.bytes,
      expires_at=excluded.expires_at;
  return private.envelope(jsonb_build_object('registered',true));
end $$;
revoke all on function public.register_student_material_upload_v1(uuid,uuid,text,text,text,bigint)
  from public,anon,authenticated;
grant execute on function public.register_student_material_upload_v1(uuid,uuid,text,text,text,bigint)
  to service_role;

do $$
declare definition text;
begin
  select pg_get_functiondef('public.submit_student_material_v1(uuid,text,text,text,text,bigint,text)'::regprocedure) into definition;
  if position('insert into private.student_material_submissions' in definition)=0 then
    raise exception 'Unexpected student material submission definition';
  end if;
  definition:=replace(definition,'insert into private.student_material_submissions',
    'delete from private.student_material_upload_receipts where student_id=v_uid
       and offering_id=p_offering_id and sha256=p_sha256 and object_key=p_object_key
       and mime_type=p_mime_type and bytes=p_bytes and expires_at>now();
     if not found then perform private.raise_error(''FORBIDDEN'',''Upload this file before submitting it.''); end if;
     insert into private.student_material_submissions');
  execute definition;
end $$;
commit;
