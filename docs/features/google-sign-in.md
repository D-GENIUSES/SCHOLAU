# Google sign-in

Sign-in and student registration offer **Continue with Google** alongside email/password.
Supabase handles the Google OAuth exchange using PKCE. The callback resolves the account
destination directly using database roles. New Google identities complete the one-time
age and terms form inside `/complete-registration`, then academic onboarding. The backend
blocks pending identities from application RPCs, protected content and realtime until
acceptance is recorded. Google metadata never assigns admin or lecturer roles.
Existing lecturer accounts can use Google; new lecturer applications retain their existing flow.
Apply `20261020001000_pending_provider_registration.sql` after the completion page is deployed.

## Hosted configuration

1. Configure a Google Auth Platform external app named ScholAu.
2. Create a Web application OAuth client. Use the Supabase dashboard's exact callback URL
   as an authorized redirect URI: `https://gbcegscbkzfxldvdiqdf.supabase.co/auth/v1/callback`.
3. Enable Google under Supabase Authentication providers and enter the client ID and secret.
   Keep secrets in Supabase, never in client code or source control. Keep nonce and email
   verification protections enabled. Request only basic identity/email/profile access.
4. Keep the Supabase Site URL at `https://scholau.vercel.app` and allow the app callback
   `https://scholau.vercel.app/auth/callback` (including its query parameters). Add an
   explicitly scoped localhost callback for development if needed.
5. Test with permitted accounts while Google is in testing mode, then publish the consent
   app for general availability after its branding and required policies are configured.

Google and Supabase dashboards must be configured before this feature works on the live app.
No Google secret is needed in Vercel. Supabase controls verified-email identity linking;
the application does not merge accounts or copy roles based on an entered email.

## Validation

From `apps/web`, run:

```sh
node --test components/auth/google-callback.test.mjs lib/utils.test.mjs lib/supabase/request-auth.test.mjs
pnpm run typecheck
pnpm exec eslint components/auth/google-sign-in.tsx components/auth/sign-in-form.tsx components/auth/sign-up-form.tsx app/auth/callback/route.ts lib/utils.ts
pnpm run build
```

Browser acceptance: start Google login, cancel and retry, complete login with an existing
account, refresh and sign out, then check a new student's academic onboarding. Verify
existing lecturer/admin roles, denied/deactivated accounts, and email/password login.
Do not count unit tests as evidence that hosted credentials or real Google login work.
