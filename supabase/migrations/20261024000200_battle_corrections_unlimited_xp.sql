begin;
create or replace function private.award_mastery_battle(p_user uuid,p_battle uuid,p_rule text,p_requested integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_day date := private.lagos_date(); v_other uuid; v_count integer; v_pair integer; v_award integer;
begin
  -- Same user lock for every XP source; finalizers acquire both users in sorted order.
  perform pg_advisory_xact_lock(hashtextextended('scholau.xp:' || p_user::text,0));
  if exists(select 1 from public.points_ledger where user_id=p_user and event_key='battle:' || p_battle::text) then return 0; end if;
  if not exists(select 1 from public.battles where id=p_battle and state='finished' and result_kind in ('win','draw')) then return 0; end if;
  select user_id into v_other from public.battle_participants where battle_id=p_battle and user_id<>p_user;
  if v_other is null then return 0; end if;
  insert into private.battle_xp_counts(user_id,local_date,completed) values(p_user,v_day,1)
    on conflict(user_id,local_date) do update set completed=private.battle_xp_counts.completed+1 returning completed into v_count;
  insert into private.battle_opponent_counts(user_id,opponent_id,local_date,completed) values(p_user,v_other,v_day,1)
    on conflict(user_id,opponent_id,local_date) do update set completed=private.battle_opponent_counts.completed+1 returning completed into v_pair;
  v_award := greatest(p_requested, 0); -- Repeat opponents and all daily matches qualify.
  return private.award_points(p_user,p_rule,'battle',p_battle,'battle:' || p_battle::text,v_award);
end $$;


do $$ declare definition text; begin
  select pg_get_functiondef('private.battle_payload(uuid,uuid)'::regprocedure) into definition;
  if strpos(definition, '''my_option_id'', mine.option_id,')=0 then raise exception 'Unexpected battle review payload'; end if;
  definition := replace(definition, $old$'my_option_id', mine.option_id,$old$,
    $new$'my_option_id', mine.option_id,
        'options', (select jsonb_agg(jsonb_build_object('id',o.id,'body',o.body,'steps',to_jsonb(o.steps)) order by ord.n)
          from unnest(bq.option_order) with ordinality ord(id,n) join public.question_options o on o.id=ord.id),
        'correct_option_id', (select k.correct_option_id from private.question_answer_keys k where k.question_version_id=qv.id),
        'explanation', (select k.explanation from private.question_answer_keys k where k.question_version_id=qv.id),$new$);
  -- Repair the legacy prompt in active and historical battle payloads without changing immutable scores.
  definition := replace(definition, $old$'prompt', qv.prompt,$old$,
    $new$'prompt', case when qv.prompt = 'What does polymorphism allow in this example?'
      then 'In Java, Dog and Cat both extend Animal and override its speak() method. What does polymorphism allow when speak() is called through an Animal reference?'
      else qv.prompt end,$new$);
  definition := replace(definition, $old$'xp_awarded', coalesce($old$, $new$'xp_reason', (select l.reason from public.points_ledger l where l.user_id=p_user_id and l.source_id=b.id and l.source_type='battle' order by l.created_at desc limit 1),
      'xp_awarded', coalesce($new$);
  execute definition;
end $$;
commit;
;
