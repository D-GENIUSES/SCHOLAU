-- The visibility setting applies to every active account, including users with
-- an additional admin role. Keep faculty scope, XP ranking and privacy filters.
begin;
do $$
declare v_def text;
  v_filter text := 'and not exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = ''admin'')';
begin
  select pg_get_functiondef('public.get_leaderboard_v1(text,uuid,text,integer)'::regprocedure) into v_def;
  if strpos(v_def,v_filter)=0 then raise exception 'Unexpected leaderboard definition'; end if;
  execute replace(v_def,v_filter,'');
end;
$$;
notify pgrst,'reload schema';
commit;
