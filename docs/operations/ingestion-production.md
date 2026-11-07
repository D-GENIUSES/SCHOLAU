# Material ingestion in production (scholau.com)

## Vercel (already required in Production env)

- `GEMINI_API_KEY`, `GEMINI_MODEL` (optional)
- `INGESTION_WORKER_SECRET` — random 64-char hex; **same value** must live in Supabase Vault
- `NEXT_PUBLIC_SITE_URL` = `https://scholau.com`
- `SUPABASE_SECRET_KEY` (or service role), R2 credentials, Supabase public keys

After deploy, uploads from the browser wake the worker via `request.url` (same origin).
The Supabase cron `scholau-ingestion-recovery` and `private.wake_ingestion_worker()` need Vault.

## Supabase Vault (one-time)

In **Project Settings → Vault** (or SQL with service role), create:

| Name | Value |
|------|--------|
| `ingestion_worker_url` | `https://scholau.com/api/material-ingestion/worker` |
| `ingestion_worker_secret` | Exact copy of Vercel `INGESTION_WORKER_SECRET` |

Migration `20261107223000_ingestion_production_wake.sql` creates `ingestion_worker_url` if missing.
You must still add **`ingestion_worker_secret`** manually to match Vercel.

## Verify

From `apps/web` with production secret in env (never commit):

```bash
node --env-file=.env.local scripts/prod-ingestion-smoke.mjs
```

Or run `local-ingestion-smoke.mjs` with `NEXT_PUBLIC_SITE_URL=https://scholau.com`.

## Deploy

Push `main` to GitHub; Vercel builds `apps/web`. Apply new migrations:

```bash
supabase db push
```

Scoped curriculum UI: `/lecturer/courses/{offeringId}/content` (requires migrations through `20261107221500`).
