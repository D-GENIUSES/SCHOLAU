-- Open clients already subscribe to user:<id>. Direct inbox inserts (friend
-- requests, battle results, assignments) never broadcast, so the bell waited
-- on cache expiry. Announcements were snapshotted and then waited for the push
-- worker before they even became inbox rows. Signal every inbox insert, and
-- deliver announcement rows in the same bounded batch the worker already uses.
create function private.signal_notification_insert() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Payload stays empty: clients refetch the inbox. Bodies must not enter the outbox.
  perform private.enqueue_event('user:'||new.user_id::text,'notification','{}'::jsonb,'notification:'||new.id::text);
  return null;
end $$;

create trigger signal_notification_insert
after insert on public.notifications
for each row execute function private.signal_notification_insert();

create function private.deliver_announcement_inbox() returns trigger
language plpgsql security definer set search_path='' as $$
declare r record;
begin
  if not exists(select 1 from inserted i where i.event_key like 'announcement:%') then
    return null;
  end if;
  for r in
    select n.* from private.notification_recipients n
    where n.processed_at is null
      and n.id in (select i.id from inserted i where i.event_key like 'announcement:%')
    order by n.id
    limit 200
  loop
    perform private.notification_event(r.user_id,r.kind,r.body,r.target,r.event_key||':'||r.user_id,r.category,r.context,r.expires_at,r.title);
    update private.notification_recipients set processed_at=now() where id=r.id;
  end loop;
  return null;
end $$;

create trigger deliver_announcement_inbox
after insert on private.notification_recipients
referencing new table as inserted
for each statement execute function private.deliver_announcement_inbox();

revoke all on function private.signal_notification_insert(),private.deliver_announcement_inbox() from public,anon,authenticated;
