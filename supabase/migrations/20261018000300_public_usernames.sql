-- One canonical public identity backed by the existing unique friend handle.
begin;
create or replace function private.public_username(p_user_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select username from public.friend_handles where user_id=p_user_id
$$;
revoke all on function private.public_username(uuid) from public,anon,authenticated;

create function private.assign_username(p_user_id uuid) returns text
language plpgsql set search_path='' as $$
declare v_base text:='learner_'||substr(replace(p_user_id::text,'-',''),1,10);
  v_candidate text:=v_base; v_suffix text; v_attempt integer:=0;
begin
  while exists(select 1 from public.friend_handles where username=v_candidate) loop
    v_attempt:=v_attempt+1; v_suffix:='_'||v_attempt::text;
    v_candidate:=left(v_base,24-length(v_suffix))||v_suffix;
  end loop;
  return v_candidate;
end;
$$;
revoke all on function private.assign_username(uuid) from public,anon,authenticated;
lock table public.friend_handles in exclusive mode;

create or replace function private.create_friend_handle() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
  select lower(btrim(raw_user_meta_data->>'username')) into v_name from auth.users where id=new.id;
  if v_name is not null and v_name !~ '^[a-z][a-z0-9_]{2,23}$' then
    perform private.raise_error('VALIDATION_FAILED','Use 3–24 characters: letters, numbers and underscores, starting with a letter.');
  end if;
  insert into public.friend_handles(user_id,username)
  values(new.id,coalesce(v_name,private.assign_username(new.id)));
  return new;
exception when unique_violation then
  perform private.raise_error('VALIDATION_FAILED','That username is already taken.');
end;
$$;
-- Preserve existing handles. Never derive usernames from email addresses.
do $$
declare v_id uuid;
begin
  for v_id in select p.id from public.profiles p left join public.friend_handles h on h.user_id=p.id
    where h.user_id is null or h.username='s_'||replace(p.id::text,'-','')
  loop
    insert into public.friend_handles(user_id,username) values(v_id,private.assign_username(v_id))
    on conflict(user_id) do update set username=excluded.username;
  end loop;
end;
$$;

create or replace function public.set_friend_username_v1(p_username text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_user(); v_name text:=lower(btrim(p_username));
begin
  perform private.assert_client_supported();
  if v_name is null or v_name !~ '^[a-z][a-z0-9_]{2,23}$' then
    perform private.raise_error('VALIDATION_FAILED',null,jsonb_build_object('username','Use 3–24 characters: letters, numbers and underscores, starting with a letter.'));
  end if;
  insert into public.friend_handles values(v_uid,v_name) on conflict(user_id) do update set username=excluded.username;
  return public.get_friends_v1();
exception when unique_violation then
  perform private.raise_error('VALIDATION_FAILED','That username already exists.',jsonb_build_object('username','That username already exists. Choose another.'));
end;
$$;

-- Extend the current payload without losing fields from later migrations.
do $$
declare v_def text;
begin
  select pg_get_functiondef('private.profile_payload(uuid)'::regprocedure) into v_def;
  if strpos(v_def,'''display_name'', p.display_name')=0 then raise exception 'Unexpected profile payload'; end if;
  execute replace(v_def,'''display_name'', p.display_name','''username'', private.public_username(p.id), ''display_name'', p.display_name');
end;
$$;

-- Legacy public display_name response keys now carry usernames.
-- Administrative records and private profile data keep their display names.
do $$
declare v_proc regprocedure; v_def text;
begin
  for v_proc in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='private' and p.proname='battle_payload')
       or (n.nspname='public' and p.proname in ('get_leaderboard_v1','get_my_battles_v1','get_battle_invitations_v1','get_friends_v1','search_friends_v1'))
  loop
    select pg_get_functiondef(v_proc) into v_def;
    v_def:=replace(v_def,'p.display_name,','private.public_username(p.id) as display_name,');
    v_def:=replace(v_def,'''display_name'',private.public_username(p.id) as display_name,','''display_name'',private.public_username(p.id),');
    v_def:=replace(v_def,'''display_name'', private.public_username(p.id) as display_name,','''display_name'', private.public_username(p.id),');
    v_def:=replace(v_def,'lower(p.display_name)','lower(private.public_username(p.id))');
    execute v_def;
  end loop;
end;
$$;

-- A separate signature avoids PostgREST overload ambiguity for old clients.
create function public.update_profile_v2(
  p_username text default null, p_display_name text default null,
  p_avatar_path text default null, p_clear_avatar boolean default false,
  p_leaderboard_visible boolean default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_user();
  perform private.assert_client_supported();
  if p_username is not null then perform public.set_friend_username_v1(p_username); end if;
  return public.update_profile_v1(p_display_name,p_avatar_path,p_clear_avatar,p_leaderboard_visible);
end;
$$;
revoke all on function public.update_profile_v2(text,text,text,boolean,boolean) from public,anon;
grant execute on function public.update_profile_v2(text,text,text,boolean,boolean) to authenticated,service_role;

create function public.is_username_available_v1(p_username text) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(lower(btrim(p_username)) ~ '^[a-z][a-z0-9_]{2,23}$',false)
    and not exists(select 1 from public.friend_handles where username=lower(btrim(p_username)))
$$;
revoke all on function public.is_username_available_v1(text) from public;
grant execute on function public.is_username_available_v1(text) to anon,authenticated,service_role;

create function public.suggest_usernames_v1(p_username text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_base text:=left(regexp_replace(lower(coalesce(p_username,'')),'[^a-z0-9_]','','g'),17);
  v_candidate text; v_names jsonb:='[]'::jsonb;
begin
  if v_base !~ '^[a-z]' then v_base:='learner'; end if;
  while jsonb_array_length(v_names)<3 loop
    v_candidate:=v_base||'_'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
    if not exists(select 1 from public.friend_handles where username=v_candidate)
      and not v_names ? v_candidate then v_names:=v_names||jsonb_build_array(v_candidate); end if;
  end loop;
  return v_names;
end;
$$;
revoke all on function public.suggest_usernames_v1(text) from public;
grant execute on function public.suggest_usernames_v1(text) to anon,authenticated,service_role;
commit;
