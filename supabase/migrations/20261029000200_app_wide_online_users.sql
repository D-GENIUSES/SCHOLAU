-- App-wide presence and server-side online-first directory pagination.
create or replace function private.user_is_online_v1(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
select exists(select 1 from private.user_presence s join auth.users u on u.id=s.user_id
join public.profiles p on p.id=u.id where s.user_id=p_user_id and s.seen_at>now()-interval '90 seconds'
and p.deactivated_at is null and u.deleted_at is null and not coalesce(u.is_anonymous,false)
and (u.banned_until is null or u.banned_until<now()));
$$;
revoke all on function private.user_is_online_v1(uuid) from public,anon,authenticated;
create index if not exists user_presence_seen_at on private.user_presence(seen_at desc);
CREATE OR REPLACE FUNCTION public.admin_list_users_v1(p_category text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_search text DEFAULT ''::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=private.require_admin(); result jsonb; total bigint;
begin
 if p_category is not null and p_category not in ('student','lecturer','other') or p_status is not null and p_status not in ('active','frozen')
 or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 or length(coalesce(p_search,''))>200 then perform private.raise_error('VALIDATION_FAILED'); end if;
 with filtered as (
 select u.id,u.created_at,private.user_is_online_v1(u.id) as online from auth.users u left join public.profiles p on p.id=u.id
 where (p_category is null or p_category=case when exists(select 1 from public.user_roles where user_id=u.id and role='lecturer') or p.registration_kind='lecturer_applicant' then 'lecturer' when exists(select 1 from public.user_roles where user_id=u.id and role='student') then 'student' else 'other' end)
 and (p_status is null or p_status=case when p.deactivated_at is null then 'active' else 'frozen' end)
 and (coalesce(btrim(p_search),'')='' or strpos(lower(coalesce(u.email,'')||' '||coalesce(p.display_name,'')),lower(btrim(p_search)))>0)
 ), page as (select * from filtered order by online desc,created_at desc nulls last,id limit p_limit offset p_offset)
 select (select count(*) from filtered),coalesce((select jsonb_agg(private.admin_user_payload(id)||jsonb_build_object('online',online) order by online desc,created_at desc nulls last,id) from page),'[]'::jsonb) into total,result;
 return private.envelope(jsonb_build_object('items',result,'total',total));
end $function$
;
create or replace function public.admin_online_users_v1(p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_admin(); result jsonb; total bigint;
begin
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then perform private.raise_error('VALIDATION_FAILED'); end if;
 with online_users as (
  select u.id,u.email,p.display_name,p.avatar_path,s.seen_at from auth.users u
  join public.profiles p on p.id=u.id join private.user_presence s on s.user_id=u.id
  where private.user_is_online_v1(u.id)
 ), page as (select * from online_users order by seen_at desc,id limit p_limit offset p_offset)
 select (select count(*) from online_users),coalesce((select jsonb_agg(to_jsonb(page) order by seen_at desc,id) from page),'[]'::jsonb) into total,result;
 return private.envelope(jsonb_build_object('items',result,'total',total,'total_users',(select count(*) from auth.users),'active_window_seconds',90));
end $$;
revoke all on function public.admin_online_users_v1(integer,integer) from public,anon;
grant execute on function public.admin_online_users_v1(integer,integer) to authenticated;
