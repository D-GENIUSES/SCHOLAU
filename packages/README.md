# Shared packages

| Workspace | Responsibility | Public entry points |
| --- | --- | --- |
| `@scholau/api` | Supabase client, contracts, queries, and hooks. | `@scholau/api`, `@scholau/api/react` |
| `@scholau/core` | Domain types, validation, and utilities. | `@scholau/core` |
| `@scholau/tokens` | Shared visual tokens and styles. | `@scholau/tokens`, `@scholau/tokens/theme.css`, `@scholau/tokens/tokens.json`, `@scholau/tokens/tailwind-preset` |

Each package declares its exports in `package.json`. Use those entry points and avoid dependencies on `apps/web`. These private workspaces are consumed as source within the monorepo.

Run `pnpm lint` and `pnpm typecheck` from the root to check all workspaces. Read the [architecture boundaries](../docs/architecture.md) before introducing shared dependencies.
