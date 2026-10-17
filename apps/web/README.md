# Web application

The `@scholau/web` workspace uses Next.js App Router. Run commands from the repository root.

| Directory | Purpose |
| --- | --- |
| `app/` | Routes, layouts, pages, and HTTP endpoints. |
| `components/` | Domain components and shared primitives in `ui/`. |
| `lib/` | Sessions, Supabase, storage, and web integrations. |
| `public/` | Browser-served static assets. |
| `scripts/` | Application-specific operational tools. |

Create `.env.local` from `.env.example` before using authenticated workflows. `pnpm --filter @scholau/web dev` starts only the web application; `pnpm --filter @scholau/web start` serves an existing production build.

See [Getting started](../../README.md#getting-started), [architecture](../../docs/architecture.md), and the [R2 guide](../../docs/operations/r2-storage.md) before running storage scripts.
