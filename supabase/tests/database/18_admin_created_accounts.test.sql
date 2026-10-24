begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc
create function pg_temp.managed_user(actor uuid, account_role text, request_key uuid, verified boolean default true) returns uuid language plpgsql as $$
declare v uuid:=gen_random_uuid(); begin
  insert into auth.users(id,email,raw_user_meta_data)
  values(v,v::text||'@test.local',jsonb_build_object('display_name','Managed test','signup_kind','admin_managed','managed_role',account_role));
  update auth.users set raw_app_meta_data=jsonb_build_object('scholau_provision',jsonb_build_object('actor_id',actor,'role',account_role,'request_key',request_key)) where id=v;
  if verified then update auth.users set email_confirmed_at=now() where id=v; end if;
  set constraints auth.admin_creation_complete immediate;
  set constraints auth.admin_creation_complete deferred;
  return v;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values('ab000000-0000-0000-0000-000000000001','managed-admin@test.local','{"display_name":"Managed admin"}');
insert into public.user_roles(user_id,role) values('ab000000-0000-0000-0000-000000000001','admin');
select set_config('t.admin','ab000000-0000-0000-0000-000000000001',true);
select set_config('t.lecturer',pg_temp.managed_user(current_setting('t.admin')::uuid,'lecturer','ab000000-0000-0000-0000-000000000010')::text,true);
select set_config('t.student',pg_temp.managed_user(current_setting('t.admin')::uuid,'student',gen_random_uuid())::text,true);
select is((select role from public.user_roles where user_id=current_setting('t.lecturer')::uuid),'lecturer','managed lecturer receives lecturer role only');
select is((select registration_kind from public.profiles where id=current_setting('t.lecturer')::uuid),'lecturer_applicant','lecturer isolated from student onboarding');
select is((select count(*)::int from public.lecturer_applications where user_id=current_setting('t.lecturer')::uuid),0,'no fabricated application');
select is((select count(*)::int from public.enrollments where user_id=current_setting('t.lecturer')::uuid),0,'no lecturer student enrollments');
select is((select total from public.user_points where user_id=current_setting('t.lecturer')::uuid),0::bigint,'no student XP for managed lecturer');
select is((select total from public.user_points where user_id=current_setting('t.student')::uuid),10::bigint,'managed student retains welcome XP');
select is((select role from public.user_roles where user_id=current_setting('t.student')::uuid),'student','managed student receives student role');
select is((select count(*)::int from private.audit_log where action='create_user' and actor_id=current_setting('t.admin')::uuid),2,'both creations audited');
select ok(not exists(select 1 from private.audit_log where action='create_user' and safe_metadata::text ilike '%password%'),'audit contains no passwords');
select throws_ok($$select pg_temp.managed_user(current_setting('t.student')::uuid,'lecturer',gen_random_uuid())$$,'PT403','FORBIDDEN','student cannot authorize creation');
select throws_ok($$select pg_temp.managed_user(current_setting('t.admin')::uuid,'admin',gen_random_uuid())$$,'PT422','VALIDATION_FAILED','cannot create administrators');
select throws_ok($$select pg_temp.managed_user(current_setting('t.admin')::uuid,'lecturer',gen_random_uuid(),false)$$,'PT422','VALIDATION_FAILED','unconfirmed managed account denied');
select throws_ok($$select pg_temp.managed_user(current_setting('t.admin')::uuid,'lecturer','ab000000-0000-0000-0000-000000000010')$$,'23505',null,'repeated request rolls back atomically');
select is((select count(*)::int from private.admin_created_accounts),2,'failed requests leave no managed accounts');
insert into auth.users(id,email,raw_user_meta_data) values('ab000000-0000-0000-0000-000000000099','forged@test.local',jsonb_build_object('display_name','Forged role','scholau_provision',jsonb_build_object('actor_id',current_setting('t.admin'),'role','lecturer','request_key',gen_random_uuid())));
select is((select role from public.user_roles where user_id='ab000000-0000-0000-0000-000000000099'),'student','user metadata cannot grant lecturer access');
select set_config('request.jwt.claim.sub',current_setting('t.lecturer'),true);
set local role authenticated;
select is(public.get_my_lecturer_courses_v1()->'items','[]'::jsonb,'managed lecturer can access workspace with no assignments');
select throws_ok('select public.admin_user_creation_access_v1()','PT403','FORBIDDEN','lecturer cannot provision');
select throws_ok('select * from private.admin_created_accounts','42501',null,'provenance not exposed to clients');
reset role;
select set_config('request.jwt.claim.sub',current_setting('t.admin'),true);
set local role authenticated;
select is(public.admin_user_creation_access_v1()->>'actor_id',current_setting('t.admin'),'active admin passes readiness check');
reset role;
update public.profiles set deactivated_at=now() where id=current_setting('t.admin')::uuid;
select throws_ok($$select pg_temp.managed_user(current_setting('t.admin')::uuid,'student',gen_random_uuid())$$,'PT403','FORBIDDEN','deactivated administrator cannot provision');
select ok(not has_function_privilege('anon','public.admin_user_creation_access_v1()','execute'),'anonymous readiness denied');
select * from finish();
rollback;

