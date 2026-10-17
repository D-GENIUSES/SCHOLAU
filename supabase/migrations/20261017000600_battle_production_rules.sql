-- Production defaults from the established battle contract; no seed users or questions.
-- Preserve any existing rules, including unpublished drafts.
insert into public.battle_rules (
  version, round_count, seconds_per_round, ready_seconds, countdown_seconds,
  queue_seconds, invite_seconds, win_xp, draw_xp, loss_xp, published_at
)
select 1, 5, 20, 10, 5, 60, 300, 25, 10, 5, now()
where not exists (select 1 from public.battle_rules)
on conflict (version) do nothing;
