-- Run inside a transaction; test addresses and all side effects are rolled back.
alter table private.welcome_email_events disable trigger welcome_email_send_on_insert;
do $$
declare uid uuid:=gen_random_uuid(); gid uuid:=gen_random_uuid(); m jsonb; admin_id uuid; r jsonb;
begin
  select jsonb_build_object('display_name','Verification test','terms_accepted',true,'terms_version',terms_version,'privacy_version',privacy_version)
    into m from private.legal_settings where singleton;
  insert into auth.users(instance_id,id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated',uid||'@example.invalid','{"provider":"email","providers":["email"]}',m,now(),now());
  if exists(select 1 from public.profiles where id=uid) or exists(select 1 from public.user_roles where user_id=uid)
    or exists(select 1 from private.legal_acceptances where user_id=uid)
    or exists(select 1 from private.welcome_email_events where user_id=uid)
    or private.admin_user_payload(uid) is not null then raise exception 'Unverified signup leaked'; end if;
  select user_id into admin_id from public.user_roles where role='admin' limit 1;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  r:=public.admin_list_users_v1(p_search:=uid||'@example.invalid');
  if r::text like '%'||uid::text||'%' then raise exception 'Directory exposed unverified email'; end if;
  update auth.users set email_confirmed_at=now() where id=uid;
  if not exists(select 1 from public.profiles where id=uid)
    or not exists(select 1 from public.user_roles where user_id=uid and role='student')
    or not exists(select 1 from private.legal_acceptances where user_id=uid)
    or not exists(select 1 from private.welcome_email_events where user_id=uid)
    or private.admin_user_payload(uid) is null then raise exception 'Verified signup incomplete'; end if;
  update auth.users set email_confirmed_at=email_confirmed_at where id=uid;
  if (select count(*) from private.welcome_email_events where user_id=uid)<>1 then raise exception 'Duplicate welcome'; end if;
  insert into auth.users(instance_id,id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values('00000000-0000-0000-0000-000000000000',gid,'authenticated','authenticated',gid||'@example.invalid','{"provider":"google","providers":["google"]}',m,now(),now());
  if not exists(select 1 from public.profiles where id=gid) or not exists(select 1 from private.pending_registrations where user_id=gid and kind='google') then raise exception 'Google flow changed'; end if;
end $$;
select 'PASS: pending email hidden; confirmation provisions profile and welcome once; Google unchanged' as result;
