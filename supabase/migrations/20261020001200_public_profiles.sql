begin;

-- Public to active signed-in users. Private profile tables and writers keep their policies.
create function private.can_view_public_profile(p_viewer uuid,p_target uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=p_target and deactivated_at is null)
    and not exists(select 1 from private.pending_registrations where user_id=p_target)
    and not exists(select 1 from public.friendships where user_low=least(p_viewer,p_target)
      and user_high=greatest(p_viewer,p_target) and state='blocked')
$$;
revoke all on function private.can_view_public_profile(uuid,uuid) from public,anon,authenticated;

-- Keep the battle payload intact while making participant identities navigable.
do $$ declare definition text; begin
  select pg_get_functiondef('private.battle_payload(uuid,uuid)'::regprocedure) into definition;
  if strpos(definition,'''seat'', bp.seat,')=0 then raise exception 'Unexpected battle participant payload'; end if;
  execute replace(definition,'''seat'', bp.seat,','''seat'', bp.seat, ''user_id'', bp.user_id,');
end $$;

create function public.get_public_profile_v1(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer uuid:=private.require_user(); result jsonb;
begin
  if not private.can_view_public_profile(viewer,p_user_id) then perform private.raise_error('NOT_FOUND'); end if;
  -- Explicit allowlist: never reuse the owner's full profile payload.
  select jsonb_build_object('id',p.id,'display_name',p.display_name,'username',h.username,
    'avatar_path',p.avatar_path,'joined_at',p.created_at,
    'university',u.name,'faculty',f.name,'department',d.name,'level',l.label,
    'xp_total',case when p.leaderboard_visible then coalesce(up.total,0) else null end,
    'badges',coalesce((select jsonb_agg(b.code order by b.awarded_at,b.code) from private.xp_badges b where b.user_id=p.id),'[]'::jsonb))
  into result from public.profiles p
  left join public.friend_handles h on h.user_id=p.id
  left join public.universities u on u.id=p.university_id
  left join public.faculties f on f.id=p.faculty_id
  left join public.departments d on d.id=p.department_id
  left join public.levels l on l.id=p.level_id
  left join public.user_points up on up.user_id=p.id where p.id=p_user_id;
  return private.envelope(result);
end $$;

create or replace function public.get_friends_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
declare viewer uuid:=private.require_user();
begin
  return private.envelope(jsonb_build_object('username',private.public_username(viewer),
    'people',coalesce((select jsonb_agg(jsonb_build_object(
      'user_id',p.id,'display_name',p.display_name,'username',h.username,
      'avatar_path',p.avatar_path,'state',f.state,'incoming',f.actor_id<>viewer) order by f.updated_at desc)
    from public.friendships f join public.profiles p on p.id=case when f.user_low=viewer then f.user_high else f.user_low end
    left join public.friend_handles h on h.user_id=p.id
    where viewer in(f.user_low,f.user_high) and p.deactivated_at is null
      and (f.state<>'blocked' or f.actor_id=viewer)),'[]'::jsonb)));
end $$;

create or replace function public.search_friends_v1(p_query text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare viewer uuid:=private.require_user(); query text:=lower(ltrim(btrim(p_query),'@'));
begin
  if length(coalesce(query,''))<3 or length(query)>60 then return private.envelope(jsonb_build_object('people','[]'::jsonb)); end if;
  return private.envelope(jsonb_build_object('people',coalesce((select jsonb_agg(x) from (
    select p.id as user_id,p.display_name,h.username,p.avatar_path,f.state,coalesce(f.actor_id<>viewer,false) as incoming
    from public.profiles p left join public.friend_handles h on h.user_id=p.id
    left join public.friendships f on f.user_low=least(viewer,p.id) and f.user_high=greatest(viewer,p.id)
    where p.id<>viewer and private.can_view_public_profile(viewer,p.id)
      and (strpos(lower(p.display_name),query)>0 or strpos(h.username,query)>0)
    order by h.username nulls last,p.id limit 20
  ) x),'[]'::jsonb)));
end $$;

-- Public profile photos use the same block/deactivation rules as profile reads.
-- Existing photo access rules for private/administrative contexts remain separate.
create function public.get_public_profile_photo_v1(p_path text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer uuid:=private.require_user(); result jsonb;
begin
  select jsonb_build_object('image_base64',encode(photo.image,'base64')) into result
  from public.profiles p join private.profile_photos photo on photo.user_id=p.id
  where p.avatar_path=p_path and p_path='avatars/'||p.id::text||'/'||photo.version::text||'.webp'
    and private.can_view_public_profile(viewer,p.id);
  if result is null then perform private.raise_error('NOT_FOUND'); end if;
  return result;
end $$;

revoke all on function public.get_public_profile_v1(uuid),public.get_public_profile_photo_v1(text) from public,anon,authenticated,service_role;
grant execute on function public.get_public_profile_v1(uuid),public.get_public_profile_photo_v1(text) to authenticated;
commit;
