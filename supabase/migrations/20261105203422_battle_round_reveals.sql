begin;

-- Only participant RPCs call this helper. Never include answers or answer keys.
create function private.battle_latest_round_result(p_battle_id uuid, p_user_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'position', q.position,
    'my_status', case when mine.user_id is null then 'unanswered' when mine.is_correct then 'correct' else 'incorrect' end,
    'opponent_status', case when theirs.user_id is null then 'unanswered' when theirs.is_correct then 'correct' else 'incorrect' end
  )
  from public.battles b
  join public.battle_questions q on q.battle_id = b.id
  join public.battle_participants me on me.battle_id = b.id and me.user_id = p_user_id
  join public.battle_participants opponent on opponent.battle_id = b.id and opponent.user_id <> p_user_id
  left join public.battle_answers mine on mine.battle_id = b.id and mine.position = q.position and mine.user_id = me.user_id
  left join public.battle_answers theirs on theirs.battle_id = b.id and theirs.position = q.position and theirs.user_id = opponent.user_id
  where b.id = p_battle_id and b.state in ('countdown', 'active', 'finished', 'voided')
    and q.opened_at <= least(now(), coalesce(b.finalized_at, now()))
    and ((mine.user_id is not null and theirs.user_id is not null)
      or q.deadline <= least(now(), coalesce(b.finalized_at, now())))
  order by q.position desc limit 1
$$;
revoke all on function private.battle_latest_round_result(uuid, uuid) from public, anon, authenticated;

-- Preserve all existing payload fields and grading behavior.
do $migration$
declare definition text; marker text;
begin
  definition := pg_get_functiondef('private.battle_payload(uuid,uuid)'::regprocedure);
  marker := '''my_answered_positions'',';
  if position(marker in definition) = 0 then raise exception 'Battle payload anchor missing'; end if;
  execute replace(definition, marker,
    '''latest_round_result'', private.battle_latest_round_result(b.id, p_user_id), ' || marker);

  definition := pg_get_functiondef('public.submit_battle_answer_v1(uuid,integer,uuid,uuid,text)'::regprocedure);
  definition := replace(definition, chr(13), '');
  marker := 'where id = p_battle_id for share;';
  if position(marker in definition) = 0 then raise exception 'Submission lock anchor missing'; end if;
  definition := replace(definition, marker, 'where id = p_battle_id for update;');
  marker := '  return private.envelope(jsonb_build_object(''battle_id'', p_battle_id, ''position'', p_position, ''accepted'', true,' || chr(10) || '    ''option_id'', p_option_id,';
  if position(marker in definition) = 0 then raise exception 'Submission acknowledgement anchor missing'; end if;
  definition := replace(definition, marker,
    '  update public.battles set revision = revision + 1 where id = p_battle_id;' || chr(10) ||
    '  perform private.battle_event(p_battle_id);' || chr(10) || marker);
  execute definition;
end $migration$;

commit;
