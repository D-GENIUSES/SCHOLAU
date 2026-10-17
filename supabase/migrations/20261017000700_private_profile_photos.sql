-- A bounded, private image per profile. Replacement and erasure are transactional;
-- originals are never persisted and no external Storage objects can become orphaned.
create table private.profile_photos (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 version uuid not null default gen_random_uuid(),
 image bytea not null check(octet_length(image) between 12 and 262144),
 updated_at timestamptz not null default now(),
 check(substring(image from 1 for 4)=decode('52494646','hex') and substring(image from 9 for 4)=decode('57454250','hex'))
);
alter table private.profile_photos enable row level security;
revoke all on private.profile_photos from public,anon,authenticated,service_role;

create function public.service_set_profile_photo_v1(p_user_id uuid,p_image_base64 text,p_expected_path text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; v uuid:=gen_random_uuid(); data bytea; path text;
begin
 select * into p from public.profiles where id=p_user_id for update;
 if not found or p.deactivated_at is not null then perform private.raise_error('FORBIDDEN'); end if;
 if p.avatar_path is distinct from p_expected_path then perform private.raise_error('STALE_REVISION'); end if;
 if p_image_base64 is null then
  delete from private.profile_photos where user_id=p_user_id;
  update public.profiles set avatar_path=null where id=p_user_id;
  return jsonb_build_object('avatar_path',null);
 end if;
 if length(p_image_base64)>349528 then perform private.raise_error('VALIDATION_FAILED'); end if;
 data:=decode(p_image_base64,'base64');
 if octet_length(data) not between 12 and 262144 or substring(data from 1 for 4)<>decode('52494646','hex') or substring(data from 9 for 4)<>decode('57454250','hex') then perform private.raise_error('VALIDATION_FAILED'); end if;
 path:='avatars/'||p_user_id::text||'/'||v::text||'.webp';
 insert into private.profile_photos(user_id,version,image) values(p_user_id,v,data)
 on conflict(user_id) do update set version=excluded.version,image=excluded.image,updated_at=now();
 update public.profiles set avatar_path=path where id=p_user_id;
 return jsonb_build_object('avatar_path',path);
end $$;

create function public.get_profile_photo_v1(p_path text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare viewer uuid:=private.require_user(); photo private.profile_photos; target public.profiles;
begin
 if p_path is null or p_path !~ '^avatars/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$' then perform private.raise_error('NOT_FOUND'); end if;
 select p.* into target from public.profiles p where p.avatar_path=p_path and p.deactivated_at is null;
 if not found then perform private.raise_error('NOT_FOUND'); end if;
 if target.id<>viewer and not private.user_is_admin(viewer)
 and not(target.leaderboard_visible and exists(select 1 from public.user_roles where user_id=target.id and role='student'))
 and not exists(select 1 from public.battle_participants a join public.battle_participants b on b.battle_id=a.battle_id where a.user_id=viewer and b.user_id=target.id) then perform private.raise_error('NOT_FOUND'); end if;
 select * into photo from private.profile_photos where user_id=target.id;
 if not found or p_path<>'avatars/'||target.id::text||'/'||photo.version::text||'.webp' then perform private.raise_error('NOT_FOUND'); end if;
 return jsonb_build_object('image_base64',encode(photo.image,'base64'),'content_type','image/webp','width',512,'height',512);
end $$;
revoke all on function public.service_set_profile_photo_v1(uuid,text,text),public.get_profile_photo_v1(text) from public,anon,authenticated,service_role;
grant execute on function public.service_set_profile_photo_v1(uuid,text,text) to service_role;
grant execute on function public.get_profile_photo_v1(text) to authenticated;

create or replace function public.update_profile_v1(
  p_display_name text default null,
  p_avatar_path text default null,
  p_clear_avatar boolean default false,
  p_leaderboard_visible boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_name text := btrim(p_display_name);
  v_errors jsonb := '{}'::jsonb;
begin
  perform private.assert_client_supported();
  if p_display_name is not null and (length(v_name) < 2 or length(v_name) > 60) then
    v_errors := v_errors || jsonb_build_object('display_name', 'must be 2-60 characters');
  end if;
  if p_display_name is not null and v_name ~ '[<>]' then
    v_errors := v_errors || jsonb_build_object('display_name', 'contains unsupported characters');
  end if;
  if p_avatar_path is not null and ((length(p_avatar_path) not between 1 and 300 or p_avatar_path !~ '^[A-Za-z0-9/_.-]+$') or p_avatar_path like '%..%') then
    v_errors := v_errors || jsonb_build_object('avatar_path', 'invalid storage path');
  end if;
  if v_errors <> '{}'::jsonb then
    perform private.raise_error('VALIDATION_FAILED', null, v_errors);
  end if;

  if p_avatar_path is not null and not p_clear_avatar and not exists(
    select 1 from private.profile_photos where user_id=v_uid and p_avatar_path='avatars/'||v_uid::text||'/'||version::text||'.webp'
  ) then perform private.raise_error('VALIDATION_FAILED','Only your uploaded profile photo may be selected.'); end if;
  if p_clear_avatar then delete from private.profile_photos where user_id=v_uid; end if;
  update public.profiles
     set display_name = coalesce(v_name, display_name),
         avatar_path = case when p_clear_avatar then null else coalesce(p_avatar_path, avatar_path) end,
         leaderboard_visible = coalesce(p_leaderboard_visible, leaderboard_visible)
   where id = v_uid;

  return private.envelope(private.profile_payload(v_uid));
end;
$$;

create or replace function private.admin_user_payload(p_user_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object('id',u.id,'email',u.email,'display_name',p.display_name,
 'avatar_path',p.avatar_path,'registered_at',u.created_at,'last_sign_in_at',u.last_sign_in_at,'email_verified',u.email_confirmed_at is not null,
 'deactivated_at',p.deactivated_at,'updated_at',p.updated_at,'has_profile',p.id is not null,
 'category',case when exists(select 1 from public.user_roles where user_id=u.id and role='lecturer') or p.registration_kind='lecturer_applicant' then 'lecturer' when exists(select 1 from public.user_roles where user_id=u.id and role='student') then 'student' else 'other' end,
 'roles',coalesce((select jsonb_agg(role order by role) from public.user_roles where user_id=u.id),'[]'::jsonb),
 'application_status',(select status from public.lecturer_applications where user_id=u.id),
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'code',c.code,'title',c.title,'status',o.status) order by c.code,o.id)
 from public.lecturer_course_assignments a join public.course_offerings o on o.id=a.offering_id join public.courses c on c.id=o.course_id where a.user_id=u.id),'[]'::jsonb))
from auth.users u left join public.profiles p on p.id=u.id where u.id=p_user_id;
$$;
