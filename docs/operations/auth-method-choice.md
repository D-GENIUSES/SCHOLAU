# Email and Google authentication choices

Student registration now opens a choice of email or Google at `/sign-up?role=student`. Email opens the existing account and study-detail form at `method=email`. Sign-in follows the same pattern. Method/back/switch links retain the safe destination and authentication notices. Lecturer registration is unchanged.

The focused layout uses ScholAu branding and equal-width rounded buttons. Google provides immediate spinner/status feedback, suppresses repeated clicks, recovers after a back-forward-cache restore, and allows retry after an error or a 15-second startup timeout. Stale attempts cannot navigate after a timeout or unmount. The provider flow remains Supabase PKCE with `prompt=select_account` in the same tab.

## Performance and routing

- Before: the student entry mounted the complete email form and requested registration legal status, including for people choosing Google. After: that form and request only run when email is selected.
- Before: the callback and destination resolver each created a Supabase client. After: the resolver reuses the callback's client and its newly exchanged session. Role, registration, onboarding and Law elective checks remain in place, including when Google receives an explicit destination.
- Successful Google callbacks still redirect directly to the resolved destination; no extra continuation redirect was added.
- Local Performance entries `scholau.auth.google.start` and `scholau.auth.google.return` measure startup and the round trip. The round trip includes user time at Google. Callback `Server-Timing` headers expose `auth_exchange`, `auth_destination` and `auth_total`. No credentials, identity data or tokens are recorded by this instrumentation.
- No production before/after latency claim is made. A completed real Google login and comparable provider timings require an authenticated test session; local simulated-provider checks do not establish Google's latency.

## Validation

Final check on 27 October 2026: all 16 authentication tests pass; TypeScript and compilation pass. The production build generates all 65 static pages, then exits with Next.js `SecurityFatalError` reporting a vulnerability in the installed framework version. The retry reports the same blocker. No framework upgrade or production deployment was performed.

Run the authentication suite from the repository root:

```sh
node --test apps/web/components/auth/auth-methods.test.mjs apps/web/components/auth/google-callback.test.mjs apps/web/lib/utils.test.mjs apps/web/lib/supabase/request-auth.test.mjs apps/web/lib/security-auth.test.mjs
```

The suite covers method URLs, notices, safe redirects, immediate Google pending state, double clicks, normal page load versus cached restoration, timeout/stale-result handling, provider failure, signup cancellation, registration/onboarding and role destinations, cookie refresh, and email recovery compatibility. CI runs these checks.

Browser inspection confirmed desktop and mobile layouts, method navigation, email field validation/focus, and a real SDK-generated handoff to a local provider fixture with PKCE and account selection. No real Google account was signed in and no real account was created. The local fixture could not complete the email registration backend round trip; existing account/study validation and registration code are retained.
