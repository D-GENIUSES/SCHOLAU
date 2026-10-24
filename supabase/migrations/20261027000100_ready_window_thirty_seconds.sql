-- After a challenge is accepted or a queue match forms, both players get 30
-- seconds to press I'm ready before the battle is cancelled.
update public.battle_rules
set ready_seconds = 30
where ready_seconds is distinct from 30;
