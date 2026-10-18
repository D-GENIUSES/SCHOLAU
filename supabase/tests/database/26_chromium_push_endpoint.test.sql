create extension if not exists pgtap with schema extensions;
begin;
select no_plan();
create function pg_temp.chromium_subscription(endpoint text) returns jsonb language sql as $$
 select jsonb_build_object('endpoint',endpoint,'keys',jsonb_build_object('p256dh',repeat('A',87),'auth',repeat('B',22)))
$$;
select ok(private.valid_push_subscription(pg_temp.chromium_subscription('https://jmt17.google.com/fcm/send/device:token')),'Chromium legacy Google endpoint is accepted');
select ok(private.valid_push_subscription(pg_temp.chromium_subscription('https://fcm.googleapis.com/wp/device:token')),'production Google endpoint remains accepted');
select ok(not private.valid_push_subscription(pg_temp.chromium_subscription('https://jmt17.google.com.attacker.test/fcm/send/token')),'lookalike legacy hostname remains rejected');
select ok(not private.valid_push_subscription(pg_temp.chromium_subscription('https://jmt17.google.com/log')),'unrelated paths on legacy Google host remain rejected');
select ok(not private.valid_push_subscription(pg_temp.chromium_subscription('https://jmt18.google.com/fcm/send/token')),'unverified alternative hosts remain rejected');
select ok(not private.valid_push_subscription(pg_temp.chromium_subscription('http://jmt17.google.com/fcm/send/token')),'HTTP legacy endpoint remains rejected');
select ok(not private.valid_push_subscription(pg_temp.chromium_subscription('https://jmt17.google.com:8443/fcm/send/token')),'custom endpoint ports remain rejected');
select ok(not private.valid_push_subscription(pg_temp.chromium_subscription('https://jmt17.google.com@127.0.0.1/fcm/send/token')),'userinfo URLs cannot bypass the allowlist');
select ok(not private.valid_push_subscription(pg_temp.chromium_subscription('https://jmt17.google.com/fcm/send/token')||'{"keys":{}}'),'legacy subscriptions still require encryption keys');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update private.push_control set enabled=true,general_release=true;
set local role authenticated;
select lives_ok($q$select public.enable_all_notifications_v1(auth.uid(),'chromium-real-shape',pg_temp.chromium_subscription('https://jmt17.google.com/fcm/send/device:token'),'Africa/Lagos')$q$,'authenticated Chromium device can enable all notifications');
reset role;
select ok(exists(select 1 from public.push_tokens where user_id=auth.uid() and device_key='chromium-real-shape' and revoked_at is null),'Chromium subscription saved as active');
select ok((select activity and academic and account and announcement and reminder from private.notification_preferences where user_id=auth.uid()),'all categories enabled after successful registration');
select * from finish();
rollback;
