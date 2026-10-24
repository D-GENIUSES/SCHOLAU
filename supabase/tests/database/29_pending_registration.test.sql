begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select set_config('t.google',gen_random_uuid()::text,true);
select set_config('t.other',gen_random_uuid()::text,true);
create function pg_temp.adult_registration() returns jsonb language sql as $$
  select jsonb_build_object('terms_accepted',true,'terms_version','2026-10-19-draft-1',
    'privacy_version','2026-10-19-draft-1','age_declaration','adult')
$$;
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values(current_setting('t.google')::uuid,'google@pending.test',now(),'{"provider":"google","providers":["google"]}','{"display_name":"Google test"}'),
  (current_setting('t.other')::uuid,'other@pending.test',now(),'{"provider":"google"}','{"display_name":"Other Google test"}');
select ok(exists(select 1 from private.pending_registrations where user_id=current_setting('t.google')::uuid),'Google identity is pending before consent');
select ok(not exists(select 1 from private.legal_acceptances where user_id=current_setting('t.google')::uuid),'OAuth metadata never fabricates consent');
select is((select leaderboard_visible from public.profiles where id=current_setting('t.google')::uuid),false,'pending account is hidden from leaderboard');
select ok(not has_table_privilege('authenticated','private.pending_registrations','select'),'pending registration details are private');
select ok(not has_function_privilege('anon','public.complete_registration_v1(jsonb)','execute'),'anonymous callers cannot complete a registration');
select set_config('request.jwt.claim.sub',current_setting('t.google'),true);
set local role authenticated;
select is((public.get_my_registration_status_v1()->>'pending')::boolean,true,'authenticated account can read its pending status');
select throws_ok($$select public.get_my_profile_v1()$$,'PT409','INVALID_STATE','pending account cannot use application RPCs');
select is(authz.can_access_topic('user:'||current_setting('t.google')),false,'pending account cannot access realtime channels');
select is(authz.is_admin(),false,'pending identity never receives admin authorization');
select throws_ok($$select public.complete_registration_v1('{}')$$,'P0001','LEGAL_ACCEPTANCE_REQUIRED','missing acceptance is rejected');
select is((public.complete_registration_v1(pg_temp.adult_registration()||'{"age_declaration":"under18"}')->>'completed')::boolean,true,'OAuth completion ignores legacy age metadata');
select is((public.complete_registration_v1(pg_temp.adult_registration())->>'completed')::boolean,true,'valid explicit acceptance completes registration');
select is((public.complete_registration_v1(pg_temp.adult_registration())->>'completed')::boolean,true,'retry is idempotent');
select is((public.get_my_registration_status_v1()->>'pending')::boolean,false,'completed account no longer needs the form');
select lives_ok($$select public.get_my_profile_v1()$$,'completed Google account can open its profile');
reset role;
select is((select count(*)::integer from private.legal_acceptances where user_id=current_setting('t.google')::uuid),1,'exactly one acceptance record is stored');
select ok(exists(select 1 from private.pending_registrations where user_id=current_setting('t.other')::uuid),'completion never changes another user');
select is((select leaderboard_visible from public.profiles where id=current_setting('t.google')::uuid),true,'completion restores the original visibility preference');
select throws_ok($$insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'spoof@pending.test','{"provider":"google","signup_kind":"google"}')$$,
  'P0001','LEGAL_ACCEPTANCE_REQUIRED','editable metadata cannot impersonate a trusted OAuth provider');
select set_config('request.jwt.claim.sub',current_setting('t.other'),true);
update public.profiles set deactivated_at=now() where id=current_setting('t.other')::uuid;
set local role authenticated;
select throws_ok($$select public.complete_registration_v1(pg_temp.adult_registration())$$,'PT401','UNAUTHENTICATED','deactivated account cannot complete registration');
reset role;
delete from auth.users where id=current_setting('t.other')::uuid;
select ok(not exists(select 1 from private.pending_registrations where user_id=current_setting('t.other')::uuid),'account erasure removes pending registration');
-- Administrators create a pending account; they never accept terms for its owner.
select set_config('t.actor',gen_random_uuid()::text,true);
select set_config('t.managed',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
values(current_setting('t.actor')::uuid,'admin@pending.test',now(),pg_temp.adult_registration()||'{"display_name":"Admin fixture"}');
insert into public.user_roles(user_id,role) values(current_setting('t.actor')::uuid,'admin');
insert into auth.users(id,email,raw_user_meta_data)
values(current_setting('t.managed')::uuid,'managed@pending.test','{"display_name":"Managed test","signup_kind":"admin_managed","managed_role":"student"}');
update auth.users set email_confirmed_at=now(),raw_app_meta_data=jsonb_build_object('scholau_provision',
  jsonb_build_object('actor_id',current_setting('t.actor'),'role','student','request_key',gen_random_uuid()))
where id=current_setting('t.managed')::uuid;
set constraints auth.admin_creation_complete immediate;
select ok(exists(select 1 from private.pending_registrations where user_id=current_setting('t.managed')::uuid),'trusted managed creation waits for the owner consent');
select ok(not exists(select 1 from private.legal_acceptances where user_id=current_setting('t.managed')::uuid),'administrator does not fabricate owner acceptance');
select set_config('request.jwt.claim.sub',current_setting('t.managed'),true);
set local role authenticated;
select throws_ok($$select public.get_my_profile_v1()$$,'PT409','INVALID_STATE','managed user cannot access the app before consent');
select is((public.complete_registration_v1(pg_temp.adult_registration())->>'completed')::boolean,true,'managed owner can explicitly complete registration');
select lives_ok($$select public.get_my_profile_v1()$$,'managed owner can access the account after consent');
reset role;
select * from finish();
rollback;
