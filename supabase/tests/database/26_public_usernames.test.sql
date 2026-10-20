create extension if not exists pgtap with schema extensions;
begin;
select no_plan();
\ir ../helpers/legal-fixtures.inc
create function pg_temp.username_user(p_handle text) returns uuid language plpgsql as $$
declare v_id uuid:=gen_random_uuid();
begin
  insert into auth.users(id,email,raw_user_meta_data,created_at,updated_at)
  values(v_id,v_id::text||'@test.local',jsonb_build_object('display_name','Private Real Name','username',p_handle),now(),now());
  return v_id;
end $$;
select set_config('t.username_id',pg_temp.username_user(' Player_One ')::text,true);
select is((select username from public.friend_handles where user_id=current_setting('t.username_id')::uuid),'player_one','Signup reserves a normalized username');
select throws_ok($$select pg_temp.username_user('PLAYER_ONE')$$,'PT422',null,'Signup rejects case-insensitive duplicates');
select throws_ok($$select pg_temp.username_user('bad name')$$,'PT422',null,'Signup validates username on server');
select ok(not exists(select 1 from public.profiles p left join public.friend_handles h on h.user_id=p.id where h.username is null),'Every existing profile has a username');
select ok(not has_function_privilege('anon','public.update_profile_v2(text,text,text,boolean,boolean)','execute'),'Guest cannot edit usernames');
select set_config('request.jwt.claim.sub',current_setting('t.username_id'),true);
set local role authenticated;
select is(public.get_my_profile_v1()->>'username','player_one','Own profile exposes username');
select is(public.update_profile_v2(p_username=>'Renamed_User')->>'username','renamed_user','Profile edit changes canonical username');
select is(public.get_friends_v1()->>'username','renamed_user','Friends use same username');
select is(public.get_my_profile_v1()->>'display_name','Private Real Name','Display name remains separate');
select is(public.is_username_available_v1('RENAMED_USER'),false,'Availability is case insensitive');
select is(public.is_username_available_v1('unused_handle'),true,'Unused handle is available');
select is(public.is_username_available_v1(null),false,'Null handle unavailable');
select set_config('t.suggestions',public.suggest_usernames_v1('Renamed_User')::text,true);
select is(jsonb_array_length(current_setting('t.suggestions')::jsonb),3,'Three alternatives suggested');
select ok((select bool_and(public.is_username_available_v1(value)) from jsonb_array_elements_text(current_setting('t.suggestions')::jsonb)),'Every suggested username is valid and available');
select is((select count(distinct value)::integer from jsonb_array_elements_text(current_setting('t.suggestions')::jsonb)),3,'Alternatives are distinct');
select throws_ok($$select public.update_profile_v2(p_username=>'invalid handle')$$,'PT422',null,'Profile edit validates usernames');
select throws_ok($$select public.update_profile_v2(p_username=>'should_rollback',p_display_name=>'X')$$,'PT422',null,'Profile and username changes are atomic');
select is(public.get_my_profile_v1()->>'username','renamed_user','Failed profile edit rolls back username');
select is((select r->>'display_name' from jsonb_array_elements(public.get_leaderboard_v1()->'rows') r where r->>'user_id'=current_setting('t.username_id')),'renamed_user','Rankings show username rather than private display name');
reset role;
select set_config('t.assigned_id',pg_temp.username_user(null)::text,true);
select ok((select username ~ '^[a-z][a-z0-9_]{2,23}$' from public.friend_handles where user_id=current_setting('t.assigned_id')::uuid),'Accounts without a chosen username receive a valid editable name');
select set_config('request.jwt.claim.sub',current_setting('t.assigned_id'),true);
set local role authenticated;
select throws_ok($$select public.update_profile_v2(p_username=>'RENAMED_USER')$$,'PT422',null,'Existing user cannot claim another username');
select is(public.update_profile_v2(p_username=>'my_chosen_name')->>'username','my_chosen_name','Automatically assigned username can be changed');
reset role;
select ok((select bool_and(strpos(pg_get_functiondef(p.oid),'p.display_name')=0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='private' and p.proname='battle_payload') or (n.nspname='public' and p.proname in ('get_my_battles_v1','get_battle_invitations_v1'))),'Battle payload, history and invitations do not expose display names');
select * from finish();
rollback;
