-- Reuse the existing 90-second heartbeat for compact public online indicators.
-- Only reveal presence where the viewer can already see the person.
begin;
do $$
declare
  definition text;
  old_row text := '''level_label'',pg.level_label)';
  new_row text := '''level_label'',pg.level_label,''online'',private.can_view_public_profile(v_uid,pg.user_id) and private.user_is_online_v1(pg.user_id))';
begin
  select pg_get_functiondef('public.get_leaderboard_v1(text,uuid,text,integer)'::regprocedure) into definition;
  if definition is null or strpos(definition,old_row)=0 then
    raise exception 'Unexpected leaderboard payload; online indicator not applied';
  end if;
  execute replace(definition,old_row,new_row);

  select pg_get_functiondef('public.get_public_profile_v1(uuid)'::regprocedure) into definition;
  if definition is null or strpos(definition,'''avatar_path'',p.avatar_path,''joined_at''')=0 then
    raise exception 'Unexpected public profile payload; online indicator not applied';
  end if;
  execute replace(definition,
    '''avatar_path'',p.avatar_path,''joined_at''',
    '''avatar_path'',p.avatar_path,''online'',private.user_is_online_v1(p.id),''joined_at''');
end $$;
notify pgrst,'reload schema';
commit;
