-- Signup welcome XP and engagement leaderboards.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc
create function pg_temp.new_user(p_name text) returns uuid language plpgsql as $$
declare v uuid:=gen_random_uuid(); begin
  insert into auth.users(instance_id,id,aud,role,email,raw_user_meta_data,created_at,updated_at)
    values('00000000-0000-0000-0000-000000000000',v,'authenticated','authenticated',v::text||'@test.local',jsonb_build_object('display_name',p_name),now(),now());
  return v;
end $$;
create function pg_temp.login(p_user uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims',json_build_object('sub',p_user,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',p_user::text,true);
  perform set_config('role','authenticated',true);
end $$;

select set_config('t.a',pg_temp.new_user('Welcome learner')::text,true) is not null as setup;
select set_config('t.b',pg_temp.new_user('Second learner')::text,true) is not null as setup;
select is((select total from public.user_points where user_id=current_setting('t.a')::uuid),10::bigint,'new account receives 10 XP immediately');
select is((select count(*)::integer from public.points_ledger where user_id=current_setting('t.a')::uuid),1,'signup creates exactly one ledger entry');
select is((select amount from public.points_ledger where user_id=current_setting('t.a')::uuid and event_key='signup:welcome'),10,'welcome event records 10 XP');
select is((select source_type from public.points_ledger where user_id=current_setting('t.a')::uuid),'signup','welcome XP has its own activity source');
select ok((select reason like '%Welcome%' from public.points_ledger where user_id=current_setting('t.a')::uuid),'history explains welcome reward');
select is(private.award_points(current_setting('t.a')::uuid,'signup_welcome','signup',current_setting('t.a')::uuid,'signup:welcome',10),0,'retrying welcome event cannot award twice');
select is((select total from public.user_points where user_id=current_setting('t.a')::uuid),10::bigint,'duplicate award leaves total at 10');
select is((select count(*)::integer from private.xp_badges where user_id=current_setting('t.a')::uuid),0,'welcome XP does not grant learning badges');

select pg_temp.login(current_setting('t.a')::uuid);
select is((public.get_home_summary_v1()->>'welcome_xp_awarded')::boolean,true,'dashboard confirms welcome award');
select is((public.get_home_summary_v1()->>'learning_xp_today')::integer,0,'welcome XP does not inflate daily learning XP');
select is(public.get_xp_progress_v1()->'progress'->>'level','1','welcome learner starts partway through level 1');
select is((public.get_xp_progress_v1()->'progress'->>'xp_into_level')::integer,10,'level progress includes welcome XP');
select is(public.get_leaderboard_v1()->>'scope','global','default leaderboard includes all faculties');
select ok((public.get_leaderboard_v1()->'me'->>'rank')::integer>=1,'new student gets a leaderboard rank without completing lessons');
select is((public.get_leaderboard_v1()->'me'->>'xp_total')::integer,10,'leaderboard includes welcome XP');
select ok(position('email' in public.get_leaderboard_v1()::text)=0,'leaderboard does not expose email addresses');
select ok(position('history' in public.get_leaderboard_v1()::text)=0,'leaderboard does not expose private XP history');
select throws_ok($$select private.award_points(auth.uid(),'signup_welcome','signup',auth.uid(),'signup:another',10)$$,'42501',null,'client cannot claim another signup award');
select is((public.get_xp_progress_v1()->>'xp_total')::integer,10,'repeated signed-in reads do not grant XP');
reset role;

-- The same totals share a rank, with deterministic cursor ordering.
select pg_temp.login(current_setting('t.b')::uuid);
select set_config('t.rank_b',public.get_leaderboard_v1()->'me'->>'rank',true) is not null as setup;
reset role;
select pg_temp.login(current_setting('t.a')::uuid);
select is(public.get_leaderboard_v1()->'me'->>'rank',current_setting('t.rank_b'),'equal welcome XP shares a rank');
reset role;
update public.profiles set leaderboard_visible=false where id=current_setting('t.b')::uuid;
select pg_temp.login(current_setting('t.b')::uuid);
select is(public.get_leaderboard_v1()->'me','null'::jsonb,'hidden student has no public ranking');
select is((public.get_xp_progress_v1()->>'xp_total')::integer,10,'hiding rank preserves personal XP');
reset role;

-- Simulate an existing zero-XP account; signup awards are not issued on reads or later sign-ins.
alter table public.profiles disable trigger profiles_user_points;
select set_config('t.legacy',pg_temp.new_user('Existing learner')::text,true) is not null as setup;
alter table public.profiles enable trigger profiles_user_points;
insert into public.user_points(user_id,total) values(current_setting('t.legacy')::uuid,0);
select pg_temp.login(current_setting('t.legacy')::uuid);
select is((public.get_home_summary_v1()->>'welcome_xp_awarded')::boolean,false,'existing account is not shown a reward it did not receive');
select is((public.get_xp_progress_v1()->>'xp_total')::integer,0,'existing account receives no retroactive bonus');
reset role;

-- Failed account creation rolls back the profile, balance, and welcome history together.
create function pg_temp.failed_signup() returns uuid language plpgsql as $$
declare v uuid:=gen_random_uuid(); begin
  begin
    insert into auth.users(id,email,raw_user_meta_data) values(v,v::text||'@failed.test','{"display_name":"Failed account"}');
    raise exception 'simulated signup rollback';
  exception when others then null;
  end;
  return v;
end $$;
select set_config('t.failed',pg_temp.failed_signup()::text,true) is not null as setup;
select is((select count(*)::integer from public.profiles where id=current_setting('t.failed')::uuid),0,'failed signup leaves no profile');
select is((select count(*)::integer from public.points_ledger where user_id=current_setting('t.failed')::uuid),0,'failed signup leaves no welcome award');
set local role anon;
select throws_ok($$select public.get_leaderboard_v1()$$,'42501',null,'guest cannot read authenticated leaderboard');
reset role;
select * from finish();
rollback;
