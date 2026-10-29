begin;

-- Only expose a busy category, never the opponent's battle/queue identifiers.
create or replace function private.battle_opponent_status(p_user_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select case
    when exists (
      select 1 from private.battle_slots s join public.battles b on b.id=s.battle_id
      where s.user_id=p_user_id and (
        (b.state='waiting' and b.invitation_expires_at>now())
        or (b.state='ready' and b.ready_deadline>now())
        or (b.state in ('countdown','active') and b.ends_at>now())
      )
    ) then 'battle'
    when exists (
      select 1 from private.battle_slots s join public.battle_queue q on q.id=s.queue_id
      where s.user_id=p_user_id and q.state='waiting' and q.expires_at>now()
    ) then 'queue'
  end;
$$;
revoke all on function private.battle_opponent_status(uuid) from public,anon,authenticated;

-- Preserve the current eligibility and idempotency rules. Reject before inserting
-- the invitation, sender reservation, notifications, or outbox events.
do $migration$
declare definition text; anchor text := $anchor$  r:=private.active_battle_rules();$anchor$;
begin
  definition:=pg_get_functiondef('public.create_scoped_battle_v1(uuid[],integer,uuid,uuid)'::regprocedure);
  if strpos(definition,'private.battle_opponent_status(p_friend_id)')=0 then
    if strpos(definition,anchor)=0 then raise exception 'Unexpected battle creation definition'; end if;
    definition:=replace(definition,anchor,$guard$
  if p_friend_id is not null and private.battle_opponent_status(p_friend_id) is not null then
    perform private.raise_error('SLOT_BUSY',
      'This learner is already in another battle or finding an opponent. Choose someone else or try again later.',
      jsonb_build_object('opponent_status',private.battle_opponent_status(p_friend_id)));
  end if;
$guard$ || anchor);
    execute definition;
  end if;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
