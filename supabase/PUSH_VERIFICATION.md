# Push notification verification — 17 October 2026

Implemented in `C:/Users/DELL/Desktop/scholau/SCHOLAU`. Existing unrelated local edits were preserved.

## Passed

- Full database regression harness: **773 assertions**, including **61 notification assertions**.
  Tested locally in PGlite with current migrations and seed, not against production users.
- Browser fixtures: **13 scenarios**, covering explicit consent, enable/disable, category settings,
  timezone/reminders, denial, mobile overflow, recipient preview, confirmation invalidation after
  edits, retry idempotency, lecturer controls, health display and account switching. No page errors.
- Encryption/worker/service-worker checks: **28 assertions**. Real VAPID request generation and
  payload encryption/decryption; mocked network responses for acceptance, 429, 410, 503, network
  failures, endpoint rejection, bounded concurrency, stale local devices and notification clicks.
- Scheduler migrations: **9 assertions** with simulated pg_net, Vault and cron. Verified minute
  recovery scheduling, missing-secret behavior, wake throttling, trigger attachment and nonfatal
  wake failures. No external HTTP requests.
- Production-runtime smoke: **6 scenarios**. GET /push-sw.js returns public JavaScript with
  no-store headers and root scope; protected settings, open-notification and composer routes
  preserve next destinations; actual Edge browser service-worker registration and activation pass.
- **2 Deno delivery-policy tests** covering provider allowlists and bounded Retry-After parsing.
- Full web ESLint, production build and TypeScript: passed. The build includes notification settings,
  authenticated notification-open routes, and lecturer/admin announcement pages.
- Supabase Edge Function `deno check`, with pinned Web Push type definitions: passed.
- Mobile settings and announcement layouts were inspected visually using browser screenshots.
- Local production server stopped after checks.

## Reproduce

In the app repository:

```text
cd apps/web
node node_modules/eslint/bin/eslint.js .
node node_modules/next/dist/bin/next build

# From the repository root, with Deno installed:
deno check supabase/functions/push-delivery/index.ts
deno test supabase/functions/push-delivery/policy_test.ts

# With a local Supabase database:
supabase test db
```

The existing workspace integration harness and added browser/runtime scripts live in
`C:/Users/DELL/Documents/ChatGPT/SCHOLAU`: `app_database_check.mjs`, `push_browser_check.cjs`,
`push_worker_check.cjs`, `push_scheduler_check.mjs` and `push_runtime_check.cjs`.
The runtime smoke script expects the built app on localhost:3118. Browser/worker fixtures are
isolated and must not be interpreted as real push-provider or physical-device verification.

## Outstanding release gates

Follow-up: the connected app initially returned PGRST202 because the notification RPC was not
deployed. A linked migration dry run confirmed that only 20261017001100 and 20261017001200 were
pending. Both were deployed successfully. The user's signed-in notification-settings page was
refreshed and verified to display real preferences and inbox data without the previous error.
Subsequent rollout: the push-delivery Edge Function is deployed; VAPID keys, the user-selected
contact, and worker authentication secret are configured. The worker URL and secret are in Vault.
The follow-up 20261017001300 scheduler migration increases its HTTP timeout to 60 seconds.
The hosted minute recovery job is active, its latest run succeeded, and its worker HTTP response
was 200. Direct verification confirmed an unauthenticated POST returns 401 and an authenticated
POST returns 200 with zero processed/accepted jobs. Delivery is enabled only for the two active
admin accounts in the pilot; general_release remains false. The user's actual settings page was
refreshed and the Enable notifications button was verified enabled. No production frontend
deployment, browser subscription consent or live device push sends were performed by the agent.
Real Android and installed iPhone PWA delivery remains unverified. No physical mobile devices were
available through this workspace. Follow `PUSH_NOTIFICATIONS.md` to configure secrets, validate
hosted scheduling, enable internal cohorts, perform device tests and expand availability.
