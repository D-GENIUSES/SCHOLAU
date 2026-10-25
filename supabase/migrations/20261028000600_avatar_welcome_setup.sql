-- Existing accounts keep their avatar without another onboarding prompt.
alter table public.profiles add column avatar_setup_completed boolean not null default true;
alter table public.profiles alter column avatar_setup_completed set default false;

create function public.get_avatar_setup_v1() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('completed',p.avatar_setup_completed) from public.profiles p where p.id=private.require_user();
$$;
create function public.complete_avatar_setup_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
declare viewer uuid:=private.require_user();
begin
 perform private.assert_client_supported();
 update public.profiles set avatar_setup_completed=true where id=viewer;
 return jsonb_build_object('completed',true);
end $$;
revoke all on function public.get_avatar_setup_v1(),public.complete_avatar_setup_v1() from public,anon,authenticated,service_role;
grant execute on function public.get_avatar_setup_v1(),public.complete_avatar_setup_v1() to authenticated;
