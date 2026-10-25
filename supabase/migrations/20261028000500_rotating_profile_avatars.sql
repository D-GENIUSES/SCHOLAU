-- Six neutral avatars, stable per account; no gender inference.
create sequence if not exists private.profile_avatar_rotation minvalue 0 maxvalue 5 start 0 cycle;
revoke all on sequence private.profile_avatar_rotation from public,anon,authenticated,service_role;
alter table public.profiles add column if not exists default_avatar smallint;

-- Rotate existing accounts without a photo separately so none are skipped.
with assigned as (
 select id,((row_number() over(partition by (avatar_path is null) order by created_at,id)-1)%6)::smallint preset
 from public.profiles
)
update public.profiles p set default_avatar=a.preset from assigned a where a.id=p.id and p.default_avatar is null;
alter table public.profiles alter column default_avatar set not null;
alter table public.profiles add constraint profile_default_avatar_range check(default_avatar between 0 and 5);

select setval('private.profile_avatar_rotation',
 case when count(*)=0 then 0 else (count(*)-1)%6 end,count(*)>0)
 from public.profiles where avatar_path is null;

create or replace function private.ensure_profile_avatar()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' and new.default_avatar is null then
  new.default_avatar:=nextval('private.profile_avatar_rotation')::smallint;
 end if;
 if new.avatar_path is null and new.deactivated_at is null then
  new.avatar_path:='presets/person-'||new.default_avatar::text;
 end if;
 return new;
end $$;
revoke all on function private.ensure_profile_avatar() from public,anon,authenticated,service_role;
create trigger profiles_default_avatar before insert or update of avatar_path,default_avatar on public.profiles
 for each row execute function private.ensure_profile_avatar();
update public.profiles set avatar_path='presets/person-'||default_avatar::text where avatar_path is null and deactivated_at is null;

create or replace function public.set_profile_avatar_v1(p_avatar_index integer,p_expected_path text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare viewer uuid:=private.require_user(); target public.profiles;
begin
 perform private.assert_client_supported();
 if p_avatar_index is null or p_avatar_index not between 0 and 5 then perform private.raise_error('VALIDATION_FAILED'); end if;
 select * into target from public.profiles where id=viewer and deactivated_at is null for update;
 if not found then perform private.raise_error('FORBIDDEN'); end if;
 if target.avatar_path is distinct from p_expected_path then perform private.raise_error('STALE_REVISION'); end if;
 delete from private.profile_photos where user_id=viewer;
 update public.profiles set default_avatar=p_avatar_index,avatar_path='presets/person-'||p_avatar_index::text where id=viewer;
 return jsonb_build_object('avatar_path','presets/person-'||p_avatar_index::text);
end $$;
revoke all on function public.set_profile_avatar_v1(integer,text) from public,anon,authenticated,service_role;
grant execute on function public.set_profile_avatar_v1(integer,text) to authenticated;

create or replace function public.service_set_profile_photo_v1(p_user_id uuid,p_image_base64 text,p_expected_path text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; v uuid:=gen_random_uuid(); data bytea; path text;
begin
 select * into p from public.profiles where id=p_user_id for update;
 if not found or p.deactivated_at is not null then perform private.raise_error('FORBIDDEN'); end if;
 if p.avatar_path is distinct from p_expected_path then perform private.raise_error('STALE_REVISION'); end if;
 if p_image_base64 is null then
  delete from private.profile_photos where user_id=p_user_id;
  update public.profiles set avatar_path=null where id=p_user_id returning avatar_path into path;
  return jsonb_build_object('avatar_path',path);
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

