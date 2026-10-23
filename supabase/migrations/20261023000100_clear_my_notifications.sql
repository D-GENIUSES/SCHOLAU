-- Let each signed-in user clear only their own notification inbox.
update public.notifications
set expires_at = created_at + interval '24 hours'
where expires_at is distinct from created_at + interval '24 hours';

create or replace function private.prepare_notification()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_battle public.battles;
begin
  if new.kind = 'battle_invitation' then
    select * into v_battle from public.battles
    where 'battle_invited:' || id::text = new.event_key;
    new.category := 'activity';
    new.title := 'Battle invitation';
    if v_battle.id is not null then
      new.context := jsonb_build_object('battle_id', v_battle.id);
    end if;
  elsif new.kind = 'lecturer_application' then
    new.category := 'account';
    new.title := 'Lecturer application';
  end if;
  new.expires_at := coalesce(new.created_at, now()) + interval '24 hours';
  return new;
end;
$$;

create function public.clear_my_notifications_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := private.require_user();
  v_deleted integer;
begin
  delete from public.notifications where user_id = v_user;
  get diagnostics v_deleted = row_count;
  return private.envelope(jsonb_build_object('deleted', v_deleted));
end;
$$;

revoke all on function public.clear_my_notifications_v1() from public, anon, authenticated;
grant execute on function public.clear_my_notifications_v1() to authenticated;
