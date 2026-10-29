-- Run in a disposable database or a rollback-only hosted test session.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create function pg_temp.assert_busy(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
create temp table busy_fixture as
select gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() c,o.id offering_id,
  o.university_id,o.department_id,o.level_id,o.semester_id
from public.course_offerings o join public.courses course on course.id=o.course_id
where o.status='published' and course.active and private.battle_pool_size(course.id)>=5 limit 1;
select pg_temp.assert_busy((select count(*)=1 from busy_fixture),'eligible fixture course');
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
select u.id,'battle-busy-'||u.id||'@example.invalid',now(),'{"provider":"email"}',
'{"display_name":"Battle busy regression","signup_kind":"student","terms_accepted":true,"terms_version":"2026-10-19-draft-1","privacy_version":"2026-10-19-draft-1","age_declaration":"adult"}'::jsonb
from busy_fixture f cross join lateral unnest(array[f.a,f.b,f.c]) u(id);
update public.profiles p set university_id=f.university_id,department_id=f.department_id,level_id=f.level_id,semester_id=f.semester_id
from busy_fixture f where p.id in (f.a,f.b,f.c);
delete from private.pending_registrations where user_id in(select a from busy_fixture union all select b from busy_fixture union all select c from busy_fixture);
create temp table opponent_battle as
with inserted as (
 insert into public.battles(offering_id,rules_id,mode,state,created_by,round_count,seconds_per_round,starts_at,ends_at,invitation_expires_at,ready_deadline)
 select offering_id,(private.active_battle_rules()).id,'direct','active',b,5,10,now()-interval '10 seconds',now()+interval '10 minutes',now()+interval '5 minutes',now()+interval '1 minute' from busy_fixture returning id
) select id from inserted;
insert into public.battle_participants(battle_id,user_id,seat) select ob.id,f.b,1 from opponent_battle ob,busy_fixture f;
insert into private.battle_slots(user_id,battle_id,expires_at) select f.b,ob.id,now()+interval '20 minutes' from busy_fixture f,opponent_battle ob;
select set_config('request.jwt.claim.sub',(select a::text from busy_fixture),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',(select a from busy_fixture),'role','authenticated')::text,true);
do $$ declare phase text; detail text; begin
 foreach phase in array array['waiting','ready','countdown','active'] loop
  update public.battles set state=phase where id=(select id from opponent_battle);
  begin
   perform public.create_scoped_battle_v1(array[(select offering_id from busy_fixture)],5,gen_random_uuid(),(select b from busy_fixture));
   raise exception 'FAILED: busy challenge accepted';
  exception when sqlstate 'PT409' then
   get stacked diagnostics detail=pg_exception_detail;
   perform pg_temp.assert_busy(detail::jsonb->>'code'='SLOT_BUSY' and detail::jsonb->'field_errors'->>'opponent_status'='battle','busy battle classified');
   perform pg_temp.assert_busy(not (detail::jsonb->'field_errors' ?| array['battle_id','queue_id']),'opponent identifiers private');
  end;
 end loop;
end $$;
select pg_temp.assert_busy(not exists(select 1 from public.battles where created_by=(select a from busy_fixture)),'no rejected invitation created');
select pg_temp.assert_busy(not exists(select 1 from private.battle_slots where user_id=(select a from busy_fixture)),'no sender slot reserved');
select pg_temp.assert_busy(not exists(select 1 from public.notifications where user_id=(select b from busy_fixture)),'no rejected invitation notification');
insert into public.friendships(user_low,user_high,actor_id,state) select least(a,b),greatest(a,b),a,'blocked' from busy_fixture;
do $$ begin
 begin perform public.create_scoped_battle_v1(array[(select offering_id from busy_fixture)],5,gen_random_uuid(),(select b from busy_fixture)); raise exception 'FAILED: blocked opponent allowed';
 exception when sqlstate 'PT403' then null; end;
end $$;
delete from public.friendships where actor_id=(select a from busy_fixture);
delete from private.battle_slots where user_id=(select b from busy_fixture);
create temp table opponent_queue as
with inserted as (insert into public.battle_queue(user_id,offering_id,request_key,expires_at)
select b,offering_id,gen_random_uuid(),now()+interval '5 minutes' from busy_fixture returning id) select id from inserted;
insert into private.battle_slots(user_id,queue_id,expires_at) select b,q.id,now()+interval '5 minutes' from busy_fixture f,opponent_queue q;
do $$ declare detail text; begin
 begin perform public.create_scoped_battle_v1(array[(select offering_id from busy_fixture)],5,gen_random_uuid(),(select b from busy_fixture)); raise exception 'FAILED: queued opponent allowed';
 exception when sqlstate 'PT409' then get stacked diagnostics detail=pg_exception_detail;
 perform pg_temp.assert_busy(detail::jsonb->'field_errors'->>'opponent_status'='queue','queue classified'); end;
end $$;
update public.battle_queue set expires_at=now()-interval '1 second' where id=(select id from opponent_queue);
select pg_temp.assert_busy(private.battle_opponent_status((select b from busy_fixture)) is null,'expired queue ignored');
delete from private.battle_slots where user_id=(select b from busy_fixture);
insert into private.battle_slots(user_id,battle_id,expires_at) select f.b,ob.id,now()+interval '20 minutes' from busy_fixture f,opponent_battle ob;
update public.battles set starts_at=now()-interval '20 minutes',ends_at=now()-interval '10 minutes' where id=(select id from opponent_battle);
select pg_temp.assert_busy(private.battle_opponent_status((select b from busy_fixture)) is null,'ended active battle ignored');
update public.battles set state='cancelled',finalized_at=now() where id=(select id from opponent_battle);
select pg_temp.assert_busy(private.battle_opponent_status((select b from busy_fixture)) is null,'terminal battle ignored');
create temp table successful_challenge as select gen_random_uuid() request_key;
alter table successful_challenge add column battle_id uuid;
update successful_challenge set battle_id=(public.create_scoped_battle_v1(array[(select offering_id from busy_fixture)],5,request_key,(select b from busy_fixture))->>'battle_id')::uuid;
select pg_temp.assert_busy((select battle_id is not null from successful_challenge),'available opponent challenge succeeds');
select pg_temp.assert_busy((select (public.create_scoped_battle_v1(array[(select offering_id from busy_fixture)],5,request_key,(select b from busy_fixture))->>'battle_id')::uuid=battle_id from successful_challenge),'same-key retry preserved');
do $$ declare detail text; begin
 begin perform public.create_scoped_battle_v1(array[(select offering_id from busy_fixture)],5,gen_random_uuid(),null); raise exception 'FAILED: sender double booked';
 exception when sqlstate 'PT409' then get stacked diagnostics detail=pg_exception_detail;
 perform pg_temp.assert_busy(detail::jsonb->'field_errors' ? 'battle_id' and not (detail::jsonb->'field_errors' ? 'opponent_status'),'sender resume error preserved'); end;
end $$;
select pg_temp.assert_busy(not has_function_privilege('authenticated','private.battle_opponent_status(uuid)','execute') and not has_function_privilege('anon','private.battle_opponent_status(uuid)','execute'),'opponent status remains private');
select 'busy-opponent regression passed' as result;
rollback;
