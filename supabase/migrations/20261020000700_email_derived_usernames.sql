-- Email-derived public handles are an explicit product choice. Never expose the domain or full email.
create or replace function private.email_username_base(p_email text) returns text
language plpgsql immutable set search_path='' as $$
declare v text;
begin
 v:=btrim(regexp_replace(lower(split_part(split_part(coalesce(p_email,''),'@',1),'+',1)),'[^a-z0-9_]+','_','g'),'_');
 if v='' then v:='student'; end if;
 if v !~ '^[a-z]' or length(v)<3 then v:='student_'||v; end if;
 return left(v,24);
end $$;
revoke all on function private.email_username_base(text) from public,anon,authenticated;

create or replace function private.available_username(p_base text,p_user_id uuid) returns text
language plpgsql set search_path='' as $$
declare v_base text:=p_base; v_candidate text; v_suffix text; v_attempt integer:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('scholau.username-allocation',0));
 v_base:=coalesce(v_base,'student'); v_candidate:=v_base;
 while exists(select 1 from public.friend_handles where username=v_candidate and user_id<>p_user_id) loop
  v_attempt:=v_attempt+1; v_suffix:='_'||v_attempt::text;
  v_candidate:=left(v_base,24-length(v_suffix))||v_suffix;
 end loop;
 return v_candidate;
end $$;
revoke all on function private.available_username(text,uuid) from public,anon,authenticated;

create or replace function private.assign_username(p_user_id uuid) returns text
language plpgsql set search_path='' as $$
declare v_base text;
begin
 select private.email_username_base(email) into v_base from auth.users where id=p_user_id;
 return private.available_username(v_base,p_user_id);
end $$;
revoke all on function private.assign_username(uuid) from public,anon,authenticated;

create or replace function private.create_friend_handle() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
 select nullif(lower(btrim(raw_user_meta_data->>'username')),'') into v_name from auth.users where id=new.id;
 if v_name is not null then
  if v_name !~ '^[a-z][a-z0-9_]{2,23}$' then
   perform private.raise_error('VALIDATION_FAILED','Use 3–24 characters: letters, numbers and underscores, starting with a letter.');
  end if;
  begin
   insert into public.friend_handles(user_id,username) values(new.id,v_name);
  exception when unique_violation then perform private.raise_error('VALIDATION_FAILED','That username is already taken.'); end;
 else
  -- A manual username edit may claim a candidate while it is being allocated. Retry safely.
  loop
   v_name:=private.assign_username(new.id);
   begin
    insert into public.friend_handles(user_id,username) values(new.id,v_name) on conflict(user_id) do nothing;
    exit;
   exception when unique_violation then null; end;
  end loop;
 end if;
 return new;
end $$;
revoke all on function private.create_friend_handle() from public,anon,authenticated;

-- Replace only missing/system-generated handles. Keep chosen usernames and account identities.
do $$
declare r record;
begin
 perform pg_advisory_xact_lock(hashtextextended('scholau.username-allocation',0));
 lock table public.friend_handles in exclusive mode;
 for r in select p.id from public.profiles p join auth.users u on u.id=p.id
  left join public.friend_handles h on h.user_id=p.id
  where h.user_id is null or (
   (h.username='s_'||replace(p.id::text,'-','') or h.username ~ ('^learner_'||substr(replace(p.id::text,'-',''),1,10)||'(_[0-9]+)?$'))
   and nullif(lower(btrim(u.raw_user_meta_data->>'username')),'') is distinct from h.username)
  order by u.created_at,p.id
 loop
  insert into public.friend_handles(user_id,username) values(r.id,private.assign_username(r.id))
   on conflict(user_id) do update set username=excluded.username;
 end loop;
end $$;
