-- Reviewer/submitter access to a submitted source, not blanket private storage access.
create function public.get_student_material_source_v1(p_submission_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_item private.student_material_submissions;
begin
  select * into v_item from private.student_material_submissions where id=p_submission_id;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if v_item.student_id <> v_uid
    and not private.can_manage_ingestion_for_offering(v_uid,v_item.offering_id)
  then perform private.raise_error('FORBIDDEN'); end if;
  return private.envelope(jsonb_build_object(
    'object_key',v_item.object_key,'filename',v_item.filename,'sha256',v_item.sha256));
end;
$$;
revoke all on function public.get_student_material_source_v1(uuid) from public,anon;
grant execute on function public.get_student_material_source_v1(uuid) to authenticated;