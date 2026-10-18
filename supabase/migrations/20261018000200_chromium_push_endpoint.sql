-- Chromium builds may return Google's legacy staging Web Push endpoint.
-- Restrict this exception to the exact host AND the documented /fcm/send/ path.
-- Source: chrome/browser/push_messaging/push_messaging_constants.cc in Chromium.
create or replace function private.valid_push_subscription(p jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p)='object' and length(p->>'endpoint') between 20 and 2048
 and ((p->>'endpoint') ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)/[A-Za-z0-9_/?=&%+.:~-]+$'
   or (p->>'endpoint') ~ '^https://jmt17[.]google[.]com/fcm/send/[A-Za-z0-9_/?=&%+.:~-]+$')
 and (p->'keys'->>'p256dh') ~ '^[A-Za-z0-9_-]{87}=?$'
 and (p->'keys'->>'auth') ~ '^[A-Za-z0-9_-]{22}={0,2}$',false)
$$;
revoke all on function private.valid_push_subscription(jsonb) from public,anon,authenticated;
