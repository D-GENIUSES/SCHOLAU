-- Live battle emoji reactions (participants only, rate limited).
create table if not exists private.battle_reactions (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('laugh', 'angry', 'handshake')),
  created_at timestamptz not null default now()
);
create index if not exists battle_reactions_battle_user_idx on private.battle_reactions (battle_id, user_id, created_at desc);
revoke all on private.battle_reactions from public, anon, authenticated;
alter table private.battle_reactions enable row level security;

create or replace function public.send_battle_reaction_v1(
  p_battle_id uuid,
  p_reaction text,
  p_request_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_state text;
  v_last timestamptz;
  v_key text;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  if p_reaction not in ('laugh', 'angry', 'handshake') then
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('reaction', 'invalid'));
  end if;
  select b.state into v_state
  from public.battles b
  join public.battle_participants p on p.battle_id = b.id and p.user_id = v_uid
  where b.id = p_battle_id;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if v_state not in ('countdown', 'active', 'ready') then
    perform private.raise_error('INVALID_STATE', 'Reactions are only available during a live battle.');
  end if;
  select created_at into v_last
  from private.battle_reactions
  where battle_id = p_battle_id and user_id = v_uid
  order by created_at desc
  limit 1;
  if v_last is not null and v_last > now() - interval '3 seconds' then
    perform private.raise_error('RATE_LIMITED', 'Wait a moment before sending another reaction.');
  end if;
  insert into private.battle_reactions (battle_id, user_id, reaction) values (p_battle_id, v_uid, p_reaction);
  v_key := 'battle_reaction:' || p_battle_id::text || ':' || v_uid::text || ':' || extract(epoch from now())::bigint::text;
  perform private.enqueue_event(
    'battle:' || p_battle_id::text,
    'reaction',
    jsonb_build_object('user_id', v_uid, 'reaction', p_reaction, 'sent_at', now()),
    v_key
  );
  return private.envelope(jsonb_build_object('sent', true, 'reaction', p_reaction), p_request_key);
end;
$$;

revoke all on function public.send_battle_reaction_v1(uuid, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.send_battle_reaction_v1(uuid, text, uuid) to authenticated;
