-- Run with existing registered administrator and non-administrator accounts. All presence changes roll back.
begin;

create temp table presence_test_actor as select u.user_id id from public.user_roles u join public.profiles p on p.id=u.user_id where u.role='admin' and p.deactivated_at is null limit 1;
create temp table presence_test_user as select u.id from auth.users u join public.profiles p on p.id=u.id where p.deactivated_at is null and not coalesce(u.is_anonymous,false) and u.deleted_at is null and (u.banned_until is null or u.banned_until<now()) and not exists(select 1 from public.user_roles r where r.user_id=u.id and r.role='admin') order by u.created_at,u.id limit 1;
create function pg_temp.assert_presence(v boolean,label text) returns void language plpgsql as $$ begin if v is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
select pg_temp.assert_presence((select count(*)=1 from presence_test_actor) and (select count(*)=1 from presence_test_user),'test scope available');
update private.user_presence set seen_at=now()-interval '2 minutes';
insert into private.user_presence(user_id,seen_at) select id,now() from presence_test_user on conflict(user_id) do update set seen_at=excluded.seen_at;
select set_config('request.jwt.claim.sub',(select id::text from presence_test_actor),true);
select pg_temp.assert_presence((public.admin_list_users_v1(null,null,'',0,1)->'items'->0->>'id')=(select id::text from presence_test_user),'online user first before pagination');
select pg_temp.assert_presence((public.admin_online_users_v1()->>'total')::int=1,'global count is independent of directory page');
select pg_temp.assert_presence(jsonb_array_length(public.admin_online_users_v1(1,1)->'items')=0 and (public.admin_online_users_v1(1,1)->>'total')::int=1,'online pagination keeps global total');
select pg_temp.assert_presence(not exists(select 1 from jsonb_array_elements(public.admin_list_users_v1(null,null,'',1,20)->'items') u where u->>'id'=(select id::text from presence_test_user)),'later directory pages exclude first online result');
update private.user_presence set seen_at=now()-interval '91 seconds';
select pg_temp.assert_presence((public.admin_online_users_v1()->>'total')::int=0,'stale heartbeat expires');
select pg_temp.assert_presence(not has_function_privilege('anon','public.admin_online_users_v1(integer,integer)','execute'),'anonymous endpoint denied');
select pg_temp.assert_presence(not has_function_privilege('authenticated','private.user_is_online_v1(uuid)','execute'),'presence helper stays private');
select set_config('request.jwt.claim.sub',(select id::text from presence_test_user),true);
do $$ begin
 begin perform public.admin_online_users_v1(); raise exception 'FAILED: non-admin read allowed'; exception when others then if sqlerrm like 'FAILED:%' then raise; end if; if sqlerrm not like '%FORBIDDEN%' then raise; end if; end;
end $$;
select jsonb_build_object('passed',true,'global_count',true,'online_first_across_pages',true,'stale_expiry',true,'non_admin_denied',true,'side_effects','rolled back') report;

rollback;
