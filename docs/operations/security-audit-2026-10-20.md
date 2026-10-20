# Security and authentication audit — 20 October 2026

Reviewed the current `staging` application, including the release changes through
`7e649cc`. Scope: email/password, Google OAuth, email confirmation and recovery,
session refresh/logout, client caches, all six HTTP API handlers, private image
and course-material storage, push delivery, dependency advisories, database RPC
authorization, RLS, assessments, battles, rewards, administration and erasure.

## Corrections

| Finding | Change |
| --- | --- |
| Session refresh cookies were discarded when the proxy returned a new redirect response. | Preserve rotated/deleted cookies and disable caching on redirects. |
| Authenticated redirects discarded query strings and could return to the same sign-in page. | Validate destinations, preserve queries/fragments and reject auth loops. |
| Email and OAuth callbacks unnecessarily passed through `/auth/continue`. | Resolve the account destination in the callback from database roles; send incomplete academic profiles directly to onboarding. |
| The global referrer header overrode callback-specific headers in the real production build. | Use `no-referrer` globally so token-bearing confirmation URLs are not forwarded. |
| Recovery destinations could override the password form. | Always send token-hash recovery to `/reset-password`. |
| Shared client query keys could retain the previous account's data. | Clear the query cache when the authenticated user changes; clear it and perform a full navigation after logout. |
| Logout errors were silently ignored. | Keep the user informed when logout fails; allow retry. |
| The ordinary sign-out button used Supabase's default global scope. | Sign out the current session so other devices remain signed in. |
| Network failures could strand authentication forms or the resend button. | Handle failures and release pending states. |
| Admin JSON bodies without Content-Length were read fully before checking their size. | Bound the incoming stream to 8 KiB. |
| The legal signup trigger rejected new Google identities and admin-provisioned accounts. | Add a pending registration state and one-time in-app consent. Email registration retains its existing atomic eligibility check. |
| Structural and ranking tests described older schema and ranking behavior. | Update explicit public RPC allowlists, schema counts and distinct-position expectations. |

## Google and managed registration

Migration `20261020001000_pending_provider_registration.sql` allows a trusted
Google identity to authenticate, then requires the owner to complete age and
terms acceptance inside `/complete-registration`. The trusted provider comes
from GoTrue `app_metadata`; editable `user_metadata` cannot enable this path.
Managed accounts use the existing transaction-scoped administrator provisioning
checks and also wait for their owner's acceptance.

Pending identities have no application RPC, protected course-content or realtime
access and are hidden from the leaderboard. Guardian validation, approval expiry,
email matching, server timestamps and private consent storage are preserved.
Existing accounts keep their current access and are not asked to accept again.
The pending state is erased with its Auth identity.

## Verification

- 11 authentication, callback, redirect, cookie and bearer-isolation regression tests passed.
- 12 legal form validation checks passed.
- 867 assertions passed against the complete migration set and database test suite
  in PGlite, with PostgreSQL role/RLS behavior and a small pgTAP compatibility shim.
  Scheduler jobs and Supabase infrastructure are outside this local runner.
- A rollback-only transaction on the hosted database validated the actual pending
  registration migration, denied pending application/realtime access and completed
  a simulated Google identity with explicit synthetic fixture consent.
- 26 HTTP checks passed against the compiled application and hosted Supabase:
  public pages, access guards, enabled providers, cross-device token-hash confirmation,
  session cookies, referrer/cache policy, student request rejection, CSRF rejection,
  invalid bearer isolation, recovery, token replay rejection, password login,
  session persistence and logout. Disposable accounts were removed.
- ESLint, TypeScript and production webpack compilation passed. Final release
  validation and real-browser OAuth results are recorded in the release evidence.
- `pnpm audit --prod --json`: no reported production dependency vulnerabilities.
  The development tree has `GHSA-vfj7-8cjw-p6xm` in `braces@3.0.3`, used by ESLint's
  glob tooling. The registry reports no published patch. It does not execute in
  the application runtime; no unverified replacement was introduced.

Run the HTTP regression tests from the repository root:

```sh
node --test apps/web/components/auth/google-callback.test.mjs apps/web/lib/utils.test.mjs apps/web/lib/supabase/request-auth.test.mjs apps/web/lib/security-auth.test.mjs
```

Run standard integration tests with a local Supabase instance using `supabase test db`.
For the compatibility runner, install `@electric-sql/pglite` in an external runtime,
set `SECURITY_TEST_RUNTIME` to that directory and run
`node scripts/test-security-database.mjs` from the repository root.

## Email delivery — explicitly pending

The hosted dashboard confirms that the project uses the default testing email
service and has no custom SMTP. Template editing requires SMTP or a paid email
capability. At the user's request, connecting a mail provider is left pending.
No SMTP credentials, subscriptions, sender domains or email settings were changed.

The confirmation and recovery HTML files in `supabase/templates/` are ready for
the later SMTP setup. Their links open `/auth/confirm` directly using `TokenHash`,
which works without the browser's PKCE verifier. Until those templates are applied
to the hosted service, default delivered links retain their existing provider
hop and PKCE/device limitations. Generated-link tests do not establish real inbox
delivery, spam placement, or mail-scanner behavior.

## Published verification

PR #8 was merged and deployed to `https://scholau.vercel.app` at production commit
`1922193afddba84a9d85fc1089771c538ed37c6c`. The additive pending-registration
migration was applied and recorded in hosted migration history after the web
deployment was ready. The same 26 authentication HTTP checks passed against
production. Seven additional production checks verified administrator account
creation, the owner completion form, rejection of pending API access, explicit
synthetic fixture acceptance, one-time prompting and subsequent onboarding.
All disposable accounts were removed. CI passed on both the PR and merged commit.

References: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[SSR client and cookie handling](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[development advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
Logout scope follows the [Supabase signOut reference](https://supabase.com/docs/reference/javascript/auth-signout).
