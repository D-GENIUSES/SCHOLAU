-- Email signups stay in Auth until confirmation. Google and managed provisioning retain their flow.
begin;

create function private.registration_is_visible(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u where u.id=p_user_id and
    (u.email_confirmed_at is not null or u.raw_app_meta_data->>'provider'='google'))
$$;
revoke all on function private.registration_is_visible(uuid) from public,anon,authenticated,service_role;

do $$
declare d text;
begin
  select pg_get_functiondef('private.handle_new_user()'::regprocedure) into d;
  d:=replace(d,E'\r\n',E'\n');
  d:=replace(d,E'begin\n',E'begin\n  if new.email_confirmed_at is null and coalesce(new.raw_app_meta_data->>''provider'',''email'')=''email'' and new.raw_user_meta_data->>''signup_kind'' is distinct from ''admin_managed'' then return new; end if;\n  if tg_op=''UPDATE'' and exists(select 1 from public.profiles where id=new.id) then return new; end if;\n');
  execute d;
  select pg_get_functiondef('private.capture_registration_legal()'::regprocedure) into d;
  d:=replace(d,E'\r\n',E'\n');
  d:=replace(d,E'begin\n',E'begin\n  if new.email_confirmed_at is null and coalesce(new.raw_app_meta_data->>''provider'',''email'')=''email'' and not exists(select 1 from private.admin_created_accounts where user_id=new.id) then return new; end if;\n  if tg_op=''UPDATE'' and exists(select 1 from private.legal_acceptances where user_id=new.id) then return new; end if;\n');
  execute d;
  select pg_get_functiondef('private.notify_admins_user_registered(uuid)'::regprocedure) into d;
  d:=replace(replace(d,E'\r\n',E'\n'),E'begin\n',E'begin\n  if not private.registration_is_visible(p_user_id) then return; end if;\n');
  execute d;
end $$;

create or replace function private.queue_welcome_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if private.registration_is_visible(new.user_id) then
    insert into private.welcome_email_events(user_id) values(new.user_id) on conflict do nothing;
  end if;
  return new;
end $$;

create function private.finish_verified_email_registration() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from private.legal_acceptances where user_id=new.id) then
    insert into private.welcome_email_events(user_id) values(new.id) on conflict do nothing;
    perform private.notify_admins_user_registered(new.id);
  end if;
  return new;
end $$;
revoke all on function private.finish_verified_email_registration() from public,anon,authenticated,service_role;

create trigger on_email_verified_create_profile after update of email_confirmed_at on auth.users
for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null and coalesce(new.raw_app_meta_data->>'provider','email')='email')
execute function private.handle_new_user();
create trigger zz_email_verified_capture_legal after update of email_confirmed_at on auth.users
for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null and coalesce(new.raw_app_meta_data->>'provider','email')='email')
execute function private.capture_registration_legal();
create trigger zz_email_verified_initialize_academic after update of email_confirmed_at on auth.users
for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null and coalesce(new.raw_app_meta_data->>'provider','email')='email')
execute function private.initialize_registration_academic();
create trigger zzz_email_verified_welcome after update of email_confirmed_at on auth.users
for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null and coalesce(new.raw_app_meta_data->>'provider','email')='email')
execute function private.finish_verified_email_registration();

-- Filter at the database boundary, including direct user lookup and totals.
do $$
declare d text;
begin
  select pg_get_functiondef('public.admin_list_users_v1(text,text,text,integer,integer)'::regprocedure) into d;
  if strpos(d,'where (p_category is null')=0 then raise exception 'Unexpected admin directory definition'; end if;
  execute replace(d,'where (p_category is null','where private.registration_is_visible(u.id) and (p_category is null');
  select pg_get_functiondef('private.admin_user_payload(uuid)'::regprocedure) into d;
  if strpos(d,'where u.id=p_user_id')=0 then raise exception 'Unexpected admin user payload'; end if;
  execute replace(d,'where u.id=p_user_id','where u.id=p_user_id and private.registration_is_visible(u.id)');
  select pg_get_functiondef('public.admin_analytics_summary_v1(integer)'::regprocedure) into d;
  execute replace(d,'from public.profiles where created_at >= v_since','from public.profiles where private.registration_is_visible(id) and created_at >= v_since');
  select pg_get_functiondef('public.admin_dashboard_v1()'::regprocedure) into d;
  d:=replace(d,'from public.lecturer_applications where status = ''pending''','from public.lecturer_applications where private.registration_is_visible(user_id) and status = ''pending''');
  d:=replace(d,'where a.status = ''pending''','where private.registration_is_visible(a.user_id) and a.status = ''pending''');
  execute d;
end $$;

insert into supabase_migrations.schema_migrations(version,name,statements)
values('20261029002000','verified_email_registration',array['Email registration waits for verification']);
commit;
