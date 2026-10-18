# Vercel deployment from GitHub

SCHOLAU is deployed using Vercel's native GitHub integration. Import
`D-GENIUSES/SCHOLAU`, select the existing account, and use these project settings:

- Root Directory: `apps/web`; include source files outside the root directory.
- Framework: Next.js; Node.js: 24.x.
- Install: `pnpm install --frozen-lockfile`.
- Build: `pnpm --filter @scholau/web build`.
- Production branch: `staging`, which contains the current application and lesson
  synchronization release. Changing the production branch is a separate release
  decision; GitHub's default `main` currently has older application code.

Push reviewed commits to `staging` to deploy. Inspect the resulting Git deployment
and verify its commit before declaring it live. There is no local-source upload
or separate deployment workflow to run. Existing GitHub CI continues to run lint,
type checks and the production build.

## Backend and storage configuration

Keep the existing Supabase project and private Cloudflare R2 bucket. Source
materials do not need to be uploaded again. Set the required application values
in Vercel's **Production** environment, using Secret values for private keys:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_APP_BUILD`, `NEXT_PUBLIC_SITE_URL`.
- `SUPABASE_SECRET_KEY` (server only).
- `LESSON_ASSET_STORAGE`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY` (R2 credentials are server only).

Use the assigned stable Vercel production origin for `NEXT_PUBLIC_SITE_URL`.
Set Supabase Auth's Site URL and confirmation/recovery callback allowlist to
that same origin. Do not give Preview deployments production credentials.
Keep Vercel's existing deployment protection unless a public-production access
change has been explicitly approved.

The application already defines security and `/push-sw.js` headers in
`next.config.ts`, so they apply on Vercel without the retired Netlify configuration.
Stop the old Netlify project's automatic builds when switching hosts.

## Release checks

Verify the public sign-in page, protected-route redirects, authentication and
recovery callbacks, same-origin authenticated writes, private R2 access, and the
course synchronization screen. Publish reviewed course bundles with an existing
administrator session, then verify lessons as an enrolled student. A successful
hosting deployment alone does not publish course content.
