create or replace function public.get_leaderboard_v1(
 p_scope text default 'global',p_faculty_id uuid default null,p_cursor text default null,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_uid uuid:=private.require_user(); v_limit integer:=least(greatest(coalesce(p_limit,20),1),100);
 v_faculty uuid; v_cursor_total bigint; v_cursor_user uuid; v_cursor_registered timestamptz;
 v_rows jsonb; v_me jsonb;
begin
 if p_scope not in ('global','faculty') or p_scope is null then
  perform private.raise_error('VALIDATION_FAILED',null,jsonb_build_object('scope','must be global or faculty'));
 end if;
 if p_scope='faculty' then
  v_faculty:=coalesce(p_faculty_id,(select faculty_id from public.profiles where id=v_uid));
  if v_faculty is null then perform private.raise_error('INVALID_PROFILE','Set your academic profile to see your faculty ranking.'); end if;
 end if;
 if p_cursor is not null then
  begin
   if array_length(string_to_array(p_cursor,':'),1)<>2 then raise exception 'invalid cursor'; end if;
   v_cursor_total:=split_part(p_cursor,':',1)::bigint;
   v_cursor_user:=split_part(p_cursor,':',2)::uuid;
   select coalesce(a.created_at,p.created_at) into v_cursor_registered from public.profiles p join auth.users a on a.id=p.id where p.id=v_cursor_user;
   if v_cursor_registered is null then raise exception 'cursor account no longer exists'; end if;
  exception when others then perform private.raise_error('VALIDATION_FAILED','Refresh the leaderboard to continue.',jsonb_build_object('cursor','invalid')); end;
 end if;
 with eligible as (
  select p.id user_id,private.public_username(p.id) display_name,p.avatar_path,coalesce(up.total,0) total,
   coalesce(a.created_at,p.created_at) registered_at,f.name faculty_name,l.label level_label
  from public.profiles p join auth.users a on a.id=p.id
  left join public.user_points up on up.user_id=p.id
  left join public.faculties f on f.id=p.faculty_id left join public.levels l on l.id=p.level_id
  where p.deactivated_at is null and p.leaderboard_visible and (v_faculty is null or p.faculty_id=v_faculty)
 ), ranked as (
  select e.*,row_number() over(order by e.total desc,e.registered_at,e.user_id) rank from eligible e
 ), page as (
  select * from ranked r where v_cursor_total is null or r.total<v_cursor_total
   or (r.total=v_cursor_total and (r.registered_at,r.user_id)>(v_cursor_registered,v_cursor_user))
  order by r.total desc,r.registered_at,r.user_id limit v_limit
 )
 select coalesce(jsonb_agg(jsonb_build_object('rank',pg.rank,'user_id',pg.user_id,'display_name',pg.display_name,
  'avatar_path',pg.avatar_path,'xp_total',pg.total,'is_me',pg.user_id=v_uid,'faculty_name',pg.faculty_name,'level_label',pg.level_label)
  order by pg.total desc,pg.registered_at,pg.user_id),'[]'::jsonb),
  (select jsonb_build_object('rank',r.rank,'xp_total',r.total) from ranked r where r.user_id=v_uid)
 into v_rows,v_me from page pg;
 return private.envelope(jsonb_build_object('scope',p_scope,'faculty_id',v_faculty,'as_of',now(),'rows',v_rows,'me',v_me,
  'next_cursor',case when jsonb_array_length(v_rows)=v_limit then (v_rows->(v_limit-1)->>'xp_total')||':'||(v_rows->(v_limit-1)->>'user_id') end));
end $$;
revoke all on function public.get_leaderboard_v1(text,uuid,text,integer) from public,anon;
grant execute on function public.get_leaderboard_v1(text,uuid,text,integer) to authenticated;
