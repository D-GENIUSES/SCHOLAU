-- Daily admin read model: midnight Africa/Lagos reset; learning history stays intact.
create table private.user_presence (
 user_id uuid primary key references auth.users(id) on delete cascade,
 seen_at timestamptz not null default now()
);
alter table private.user_presence enable row level security;
revoke all on private.user_presence from public,anon,authenticated;

create function public.user_heartbeat_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();
begin
 insert into private.user_presence(user_id) values(u)
 on conflict(user_id) do update set seen_at=now();
 return private.envelope('{}'::jsonb);
end $$;
create function public.admin_user_insights_v1(p_user_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_admin(); result jsonb; day_start timestamptz:=date_trunc('day',now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
begin
 if cardinality(p_user_ids)>20 then perform private.raise_error('VALIDATION_FAILED'); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'department',d.name,'faculty',f.name,'level',l.label,
 'online',coalesce(s.seen_at>now()-interval '90 seconds',false) and p.deactivated_at is null,
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.at desc,e.id) from (
 select 'signup:'||u.id as id,'Signed up' as label,u.created_at as at where u.created_at>=day_start
 union all select 'lesson:'||x.lesson_id,'Started lesson',x.started_at from public.lesson_progress x where x.user_id=u.id and x.started_at>=day_start
 union all select 'complete:'||x.lesson_id,'Completed lesson',x.completed_at from public.lesson_progress x where x.user_id=u.id and x.completed_at>=day_start
 union all select 'quiz:'||x.id,'Started quiz',x.started_at from public.assessment_attempts x where x.user_id=u.id and x.started_at>=day_start
 union all select 'result:'||x.id,'Quiz '||x.status||' · '||coalesce(x.correct_count,0)||'/'||x.total_count,x.finalized_at from public.assessment_attempts x where x.user_id=u.id and x.finalized_at>=day_start
 union all select 'join:'||x.battle_id,'Joined battle',x.joined_at from public.battle_participants x where x.user_id=u.id and x.joined_at>=day_start
 union all select 'battle:'||b.id,'Battle '||b.state||' · '||coalesce(x.correct_count,0)||' correct',b.finalized_at from public.battle_participants x join public.battles b on b.id=x.battle_id where x.user_id=u.id and b.finalized_at>=day_start
 ) e),'[]'::jsonb))) ,'[]'::jsonb) into result
 from auth.users u left join public.profiles p on p.id=u.id
 left join public.departments d on d.id=p.department_id left join public.faculties f on f.id=p.faculty_id
 left join public.levels l on l.id=p.level_id left join private.user_presence s on s.user_id=u.id
 where u.id=any(p_user_ids);
 return private.envelope(jsonb_build_object('items',result,'total_users',(select count(*) from auth.users),'resets_at',day_start+interval '1 day'));
end $$;
create function public.admin_battle_players_v1(p_battle_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_admin(); result jsonb;
begin
 if cardinality(p_battle_ids)>100 then perform private.raise_error('VALIDATION_FAILED'); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'course',c.code,'rounds',b.round_count,'winner_id',b.winner_user_id,
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'score',x.correct_count,'forfeited',x.forfeited_at is not null) order by x.seat) from public.battle_participants x join public.profiles p on p.id=x.user_id where x.battle_id=b.id),'[]'::jsonb))),'[]'::jsonb) into result
 from public.battles b join public.course_offerings o on o.id=b.offering_id join public.courses c on c.id=o.course_id where b.id=any(p_battle_ids);
 return private.envelope(jsonb_build_object('items',result));
end $$;
revoke all on function public.user_heartbeat_v1(),public.admin_user_insights_v1(uuid[]),public.admin_battle_players_v1(uuid[]) from public,anon;
grant execute on function public.user_heartbeat_v1(),public.admin_user_insights_v1(uuid[]),public.admin_battle_players_v1(uuid[]) to authenticated;
