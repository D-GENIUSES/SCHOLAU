-- Admin: re-queue succeeded ingestion jobs with force_reprocess for Khan-style content backfill.
create or replace function public.admin_list_ingestion_reteach_v1(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
begin
  return private.envelope(jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'job_id', j.id,
        'course_id', j.course_id,
        'course_code', c.code,
        'filename', j.filename,
        'sha256', j.sha256,
        'succeeded_at', j.updated_at
      ) order by j.updated_at desc)
      from private.material_ingestion_jobs j
      join public.courses c on c.id = j.course_id
      where j.status = 'succeeded'
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    ), '[]'::jsonb)
  ));
end;
$$;

create or replace function public.admin_queue_ingestion_reteach_v1(p_job_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_src private.material_ingestion_jobs;
  v_job private.material_ingestion_jobs;
begin
  perform private.require_request_key(p_request_key);
  select * into v_src from private.material_ingestion_jobs where id = p_job_id and status = 'succeeded';
  if not found then perform private.raise_error('NOT_FOUND', 'Succeeded ingestion job not found.'); end if;
  insert into private.material_ingestion_jobs (
    offering_id, course_id, uploaded_by, sha256, filename, object_key, bytes, mime_type,
    topic_mode, module_title, module_position, confirmed_outline, battle_mix, force_reprocess, request_key
  ) values (
    v_src.offering_id, v_src.course_id, v_uid, v_src.sha256, v_src.filename, v_src.object_key, v_src.bytes, v_src.mime_type,
    v_src.topic_mode, v_src.module_title, v_src.module_position, v_src.confirmed_outline, v_src.battle_mix, true, p_request_key
  ) returning * into v_job;
  perform private.wake_ingestion_worker();
  return private.envelope(jsonb_build_object('job_id', v_job.id, 'status', v_job.status, 'force_reprocess', true), p_request_key);
end;
$$;

revoke all on function public.admin_list_ingestion_reteach_v1(integer) from public, anon, authenticated, service_role;
revoke all on function public.admin_queue_ingestion_reteach_v1(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_ingestion_reteach_v1(integer) to authenticated;
grant execute on function public.admin_queue_ingestion_reteach_v1(uuid, uuid) to authenticated;
