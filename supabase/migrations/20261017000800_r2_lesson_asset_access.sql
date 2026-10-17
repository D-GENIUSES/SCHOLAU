-- R2 has no Supabase RLS. The server must check these RPCs with the caller's JWT before signing.
create function public.can_read_lesson_asset_v1(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(authz.is_active_user() and authz.can_read_lesson_asset(p_path), false)
$$;

create function public.lesson_asset_upload_course_v1(p_lesson_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select l.course_id from public.lessons l
  where l.id = p_lesson_id and authz.is_active_user() and authz.is_admin()
$$;

revoke all on function public.can_read_lesson_asset_v1(text), public.lesson_asset_upload_course_v1(uuid) from public, anon, authenticated;
grant execute on function public.can_read_lesson_asset_v1(text), public.lesson_asset_upload_course_v1(uuid) to authenticated;
