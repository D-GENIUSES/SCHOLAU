-- Preserve profile photographs alongside the new administrator XP balance.
create or replace function private.admin_user_payload(p_user_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object('id',u.id,'email',u.email,'display_name',p.display_name,
 'xp_total',coalesce((select total from public.user_points where user_id=u.id),0),
 'avatar_path',p.avatar_path,'registered_at',u.created_at,'last_sign_in_at',u.last_sign_in_at,'email_verified',u.email_confirmed_at is not null,
 'deactivated_at',p.deactivated_at,'updated_at',p.updated_at,'has_profile',p.id is not null,
 'category',case when exists(select 1 from public.user_roles where user_id=u.id and role='lecturer') or p.registration_kind='lecturer_applicant' then 'lecturer' when exists(select 1 from public.user_roles where user_id=u.id and role='student') then 'student' else 'other' end,
 'roles',coalesce((select jsonb_agg(role order by role) from public.user_roles where user_id=u.id),'[]'::jsonb),
 'application_status',(select status from public.lecturer_applications where user_id=u.id),
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'code',c.code,'title',c.title,'status',o.status) order by c.code,o.id)
 from public.lecturer_course_assignments a join public.course_offerings o on o.id=a.offering_id join public.courses c on c.id=o.course_id where a.user_id=u.id),'[]'::jsonb))
from auth.users u left join public.profiles p on p.id=u.id where u.id=p_user_id;
$$;

