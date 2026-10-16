-- Client-reported signals; three strikes use the existing early-forfeit rules.
create table public.battle_integrity_events (
  event_id uuid primary key,
  battle_id uuid not null,
  user_id uuid not null,
  kind text not null check (kind in ('app_hidden','focus_lost','possible_split_screen','fullscreen_exit','copy_attempt')),
  received_at timestamptz not null default now(),
  foreign key (battle_id,user_id) references public.battle_participants(battle_id,user_id) on delete cascade
);
create index battle_integrity_review on public.battle_integrity_events(battle_id,user_id,received_at);
alter table public.battle_integrity_events enable row level security;
revoke all on public.battle_integrity_events from anon,authenticated;
grant select on public.battle_integrity_events to authenticated;
create policy integrity_read on public.battle_integrity_events for select to authenticated
  using (user_id = auth.uid() or authz.is_admin());

create function public.report_battle_integrity_v1(p_battle_id uuid,p_event_id uuid,p_kind text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  b public.battles;
  v_count integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  b := private.lock_participant_battle(v_uid,p_battle_id);
  -- Allow delayed delivery after finalization, but never accept pre-battle reports.
  if b.starts_at is null or b.state not in ('countdown','active','finished','cancelled','voided') then
    raise exception 'Battle has not started';
  end if;
  if now() > coalesce(b.finalized_at,b.ends_at,now()) + interval '1 hour' then
    raise exception 'Reporting window closed';
  end if;
  select count(*) into v_count from public.battle_integrity_events where battle_id=p_battle_id and user_id=v_uid;
  if b.state in ('countdown','active') and (b.ends_at is null or now() < b.ends_at) and v_count < 3 then
    -- Blur + hidden from one app switch are one strike, including across tabs/retries.
    if not (p_kind in ('app_hidden','focus_lost') and exists (
      select 1 from public.battle_integrity_events where battle_id=p_battle_id and user_id=v_uid
      and kind in ('app_hidden','focus_lost') and received_at > clock_timestamp() - interval '2 seconds'
    )) then
      insert into public.battle_integrity_events(event_id,battle_id,user_id,kind,received_at)
        values(p_event_id,p_battle_id,v_uid,p_kind,clock_timestamp()) on conflict(event_id) do nothing;
    end if;
    select count(*) into v_count from public.battle_integrity_events where battle_id=p_battle_id and user_id=v_uid;
    if v_count >= 3 then
      update public.battle_participants set forfeited_at=now() where battle_id=p_battle_id and user_id=v_uid;
      perform private.cancel_battle(p_battle_id,'early_forfeit','forfeit');
    end if;
  end if;
  return jsonb_build_object('strikes',v_count,'forfeited',v_count >= 3);
end;
$$;
revoke all on function public.report_battle_integrity_v1(uuid,uuid,text) from public,anon;
grant execute on function public.report_battle_integrity_v1(uuid,uuid,text) to authenticated;
