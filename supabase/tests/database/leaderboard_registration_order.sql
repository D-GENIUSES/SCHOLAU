-- Transactional fixtures: callers must wrap this file in BEGIN / ROLLBACK.
do $$
declare ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 i integer; top_xp bigint; board jsonb; page2 jsonb; actual uuid[]; expected uuid[]; same_time uuid[];
 faculty uuid; uni uuid; lvl uuid;
begin
 select coalesce(max(total),0)+100 into top_xp from public.user_points;
 select f.id,f.university_id into faculty,uni from public.faculties f join public.universities u on u.id=f.university_id where u.slug='adeleke-university-ede-osun-state' and f.name='Faculty of Science';
 select id into lvl from public.levels where university_id=uni order by sort_order limit 1;
 for i in 1..4 loop
  insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(ids[i],'authenticated','authenticated',ids[i]::text||'@example.invalid',now(),'{"provider":"email"}',
   jsonb_build_object('username','test_'||left(replace(ids[i]::text,'-',''),12),'display_name','Leaderboard test'),
   case when i in (1,4) then '2020-01-01'::timestamptz when i=2 then '2021-01-01'::timestamptz else '2022-01-01'::timestamptz end,now());
  update public.user_points set total=top_xp+case when i=3 then 10 else 0 end where user_id=ids[i];
 end loop;
 -- Use a valid full academic relationship, just as the real registration path does.
 update public.profiles p set university_id=uni,faculty_id=faculty,
  department_id=(select id from public.departments where faculty_id=faculty and active order by name limit 1),
  level_id=lvl,academic_period_id=(select id from public.academic_periods where university_id=uni and active order by starts_on desc limit 1),
  semester_id=(select s.id from public.semesters s join public.academic_periods a on a.id=s.academic_period_id where s.university_id=uni and s.active and a.active order by a.starts_on desc,s.sort_order limit 1)
 where p.id=any(ids);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[2],'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',ids[2]::text,true);
 board:=public.get_leaderboard_v1('global',null,null,4);
 select array_agg((r->>'user_id')::uuid order by n) into actual from jsonb_array_elements(board->'rows') with ordinality x(r,n);
 same_time:=array[least(ids[1],ids[4]),greatest(ids[1],ids[4])];expected:=array[ids[3],same_time[1],same_time[2],ids[2]];
 if actual is distinct from expected then raise exception 'XP or registration-time tie order incorrect: % <> %',actual,expected; end if;
 for i in 0..3 loop
  if (board->'rows'->i->>'rank')::integer<>i+1 then raise exception 'Ranks are not consecutive'; end if;
  if board->'rows'->i->>'faculty_name'<>'Faculty of Science' or board->'rows'->i->>'level_label' is null then raise exception 'Academic labels missing'; end if;
 end loop;
 if (board->'me'->>'rank')::integer<>4 then raise exception 'My position disagrees with list'; end if;
 board:=public.get_leaderboard_v1('global',null,null,2);
 page2:=public.get_leaderboard_v1('global',null,board->>'next_cursor',2);
 if (page2->'rows'->0->>'user_id')::uuid<>expected[3] or (page2->'rows'->1->>'user_id')::uuid<>expected[4] then raise exception 'Tie pagination skipped or duplicated rows'; end if;
 board:=public.get_leaderboard_v1('faculty',faculty,null,4);
 if (board->'rows'->3->>'rank')::integer<>4 then raise exception 'Faculty scope order differs'; end if;
 update public.profiles set leaderboard_visible=false where id=ids[3];
 board:=public.get_leaderboard_v1('global',null,null,4);
 if exists(select 1 from jsonb_array_elements(board->'rows') r where (r->>'user_id')::uuid=ids[3]) then raise exception 'Hidden account leaked'; end if;
 update public.profiles set deactivated_at=now() where id=ids[1];
 board:=public.get_leaderboard_v1('global',null,null,4);
 if exists(select 1 from jsonb_array_elements(board->'rows') r where (r->>'user_id')::uuid=ids[1]) then raise exception 'Deactivated account leaked'; end if;
 if has_function_privilege('anon','public.get_leaderboard_v1(text,uuid,text,integer)','execute') then raise exception 'Anonymous leaderboard access changed'; end if;
end $$;
