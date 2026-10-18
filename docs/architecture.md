# Architecture and organization

## Workspace boundaries

`apps/web` composes the user experience. `packages/api` owns Supabase access and data contracts. `packages/core` provides domain types, validation, and utilities. `packages/tokens` maintains shared visual foundations. PostgreSQL enforces persistent business and authorization rules through migrations, RPCs, and policies.

Import shared packages through their `@scholau/*` exports. Avoid relative imports into another workspace's internals. Shared packages must not depend on routes or components in `apps/web`.

## Where code belongs

| Change | Location |
| --- | --- |
| Page, layout, or HTTP endpoint | `apps/web/app/` |
| Domain interface | `apps/web/components/<domain>/` |
| Reusable UI primitive | `apps/web/components/ui/` |
| Next.js or web-server integration | `apps/web/lib/` |
| Shared query, mutation, data contract, or hook | `packages/api/src/` |
| Shared domain type, schema, or utility | `packages/core/src/` |
| Shared visual token or style | `packages/tokens/` |
| Persistent schema or permission change | `supabase/migrations/` |
| Database regression | `supabase/tests/database/` |
| Feature or operational guide | `docs/features/` or `docs/operations/` |

Next.js route groups `(auth)`, `(student)`, and `(focus)` organize layouts. Preserve route names unless a functional change requires otherwise. Organization changes should preserve URLs, imports, permissions, and migration order.

## Assets and academic data

`assets/brand` contains brand source assets and their manifest. `apps/web/public` contains browser-served files. Review the distribution process before attempting to deduplicate them.

`supabase/curricula` keeps academic data, source documents, and reconciliations together. Its auxiliary SQL scripts record specific operations; they do not replace migration history or form a general deployment sequence.

## Configuration and validation

The root owns workspace manifests, the lockfile, and task configuration. Each package owns its manifest and TypeScript configuration. Local web secrets belong in `apps/web/.env.local`.

CI checks lint, types, and compilation without production credentials. Permission and business-rule regressions also need database tests. User workflows require verification with test accounts and published content in a development environment.
