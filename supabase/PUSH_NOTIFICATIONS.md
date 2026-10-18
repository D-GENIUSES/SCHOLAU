# Web Push notifications

Deployment status: the worker, VAPID credentials, Vault entries and hosted recovery job are
configured for the connected project. Delivery is enabled for an **admin-only pilot**; general
availability remains off. Each browser still requires explicit notification permission. Applying
the source migrations to another environment starts delivery disabled.

## Architecture and contracts

Existing inbox inserts synchronously enqueue one job per active, consented web subscription in the
same transaction. Realtime keeps its existing outbox and behavior. Publication and announcement
recipient snapshots fan out in batches of 200; push sends run in batches of 20, with concurrency 5.
The Edge Function prepares inbox fan-out even when delivery is paused or VAPID is unconfigured.
Enqueue wakeups are best-effort and transactionally deferred by pg_net; a minute-based cron recovers
missed wakeups, reminders and expired leases. New lessons and assessments generate course-content
events; replacement versions, XP rewards and per-question battle updates do not send push.

User RPCs: `get_notification_preferences_v1`, `update_notification_preferences_v1`, existing
`register_push_token_v1` / `revoke_push_token_v1`, `get_announcement_audiences_v1`,
`preview_announcement_v1`, `send_announcement_v1`, `open_notification_v1`, `admin_push_health_v1`.
The API package contains their response types and settings hooks. Announcement retries use the
same request UUID; changing the request body requires a new key. Eligibility and recipient counts
are checked again at send time. Only approved lecturers may send to assigned offerings; admins
may send to offerings, account roles, or everyone. The hourly limit is configurable in push_control.

`prepare_push_batch_v1`, `claim_push_jobs_v1`, `authorize_push_job_v1`, `finish_push_job_v1` are
service-role-only RPCs. Subscription credentials are never exposed in client table reads or health
responses. Payloads contain an inbox ID, title, plain-text body, internal destination, expiry and
device key. The worker validates browser-provider endpoints again and refuses HTTP redirects.
Client input cannot supply arbitrary fetch URLs. VAPID credentials never enter browser bundles.

Quiet hours default to 22:00–08:00; opt-in reminders default to 19:00. Enabling push saves the
browser timezone, falling back to Africa/Lagos. Qualifying activity uses activity_events timestamps
converted to the user's timezone; it does not change the application's existing streak calculation.
Reminders send once per local calendar date and expire at the following local midnight. Timezone
changes can create a different local date. Browsers and operating systems control final display
timing; server quiet hours govern when ScholAu submits a message to the push service.

Jobs use two-minute leases and at most eight attempts; transient failures use bounded exponential
backoff and Retry-After. Accepted means accepted by the provider, not delivered. Transport is
at-least-once; repeated visible notifications share a stable tag. Revoked devices suppress already
accepted messages through local IndexedDB state. There is no silent-push or background inbox cache.

## Deploy with delivery disabled

1. Apply migrations `20261017001100_web_push.sql`, `20261017001200_push_jobs.sql` and
   `20261017001300_push_worker_timeout.sql` through the
   normal Supabase migration process. The scheduling migration requires hosted pg_cron, pg_net,
   and Vault. Earlier migrations already install pg_cron. Never add the private schema to Data API.
2. Generate an ES256 VAPID keypair once with `web-push generate-vapid-keys --json`, and a random
   worker secret of at least 32 characters. Store them in your secret manager. Do not commit keys,
   paste private values into SQL files, or print them in CI logs.
3. Configure Edge Function secrets: `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`,
   `PUSH_VAPID_SUBJECT` (a real `mailto:` contact), and `PUSH_WORKER_SECRET`.
   Hosted Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy `supabase functions deploy push-delivery`. The function's verify_jwt=false is intentional:
   it authenticates a dedicated x-push-worker-secret header using constant-time digest comparison.
   No user JWT, anon key or browser may trigger privileged work.
5. Using a secure parameterized administrative session, put the full deployed function URL into
   Vault secret `push_worker_url` and the identical worker secret into `push_worker_secret`.
   The secrets are read by the wake helper; never grant clients Vault reads. On secret rotation,
   update both locations together. Verify the cron job `scholau-push-recovery` exists once.
6. Set only the **public** VAPID key in `private.push_control.vapid_public_key`, matching the Edge
   Function's public key. Deploy the web application. Confirm unauthenticated GET /push-sw.js
   returns JavaScript with no-cache headers, not a sign-in redirect.

## Staged rollout and operations

Use privileged SQL (UUIDs and keys below are placeholders) to opt internal accounts into the cohort:

```sql
update private.push_control
set enabled=true, general_release=false,
    cohort=array['INTERNAL-USER-UUID'::uuid],
    vapid_public_key='PUBLIC-VAPID-KEY'
where singleton;
```

Open `/notification-settings` from each role's navigation. Enable only explicit tester devices.
Run the checklist below, then expand cohort to selected opt-in users. For general availability,
set general_release=true after reviewing queue health. Push permission is still required per device.

```sql
-- Delivery kill switch. Inbox creation and announcement fan-out continue.
update private.push_control set enabled=false where singleton;
-- After validation, enable general availability:
update private.push_control set enabled=true,general_release=true where singleton;
```

Settings: `/notification-settings`; composers: `/admin/announcements` and
`/lecturer/announcements`. Admin composer includes aggregate queue health and recent redacted
failure codes. Watch oldest pending age, pending fan-out, persistent 401/403 provider errors,
429 rates, failures and scheduler failures. Check cron.job_run_details and Edge Function failures
without logging payloads/endpoints. Jobs recover abandoned leases on the next minute invocation.
30-day terminal diagnostics and processed fan-out snapshots are removed by the preparation job.
Durable publication markers survive cleanup to prevent edited lessons being announced again.
The kill switch stops new claims and eligibility checks; an HTTP send already in flight may finish.

## Verification and release gates

Automated verification uses isolated data: full database regressions, notification-specific SQL,
browser fixtures for consent/settings/composer/idempotency/account switching, actual payload
encryption/decryption, mocked transport and service-worker handlers. Scheduler SQL is tested with
stubbed cron, Vault and pg_net; this does not prove the hosted job executes.

Before general release, check real supported desktop browsers, Android Chrome, and an installed
iPhone/iPad PWA (iOS/iPadOS 16.4+):

- Enable, deny, revoke in browser settings, reconnect, sign out and switch accounts. No initial
  page load prompts for permission. Old-account accepted messages must not appear after logout.
- Receive a friend request/acceptance, battle invitation/acceptance before its deadline, first
  lesson publication, lecturer submission/decision and course assignment. Confirm expired,
  blocked, read or inaccessible events are suppressed.
- Preview and send lecturer/admin announcements. Confirm recipient boundaries and retry
  idempotency. Test quiet hours, reminder opt-in and completion before the daily reminder.
- Close the application, receive a notification, then click while signed out. Sign in and reach
  the authorized target. Test an expired invitation and a deleted notification fallback.
- Pause delivery; verify inbox still fills. Stop the worker mid-batch, verify lease recovery,
  then verify permanent errors revoke endpoints. Confirm the hosted minute recovery job works.

No Android/iPhone hardware or real push-provider acceptance is implied by a successful build or
browser fixture. A production rollout remains gated on credentials and those device checks.

Protocol/runtime references: [Web Push library](https://github.com/web-push-libs/web-push),
[Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions),
[Apple Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
