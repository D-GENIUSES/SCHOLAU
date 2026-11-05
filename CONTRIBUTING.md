# Contributing to SCHOLAU

## Preparation

Follow [Getting started](README.md#getting-started), use pnpm 12.11.2, and read the `AGENTS.md` files applicable to the directories you change. The [architecture guide](docs/architecture.md) explains where each kind of change belongs.

## Workflow

1. Synchronize your clean `main` checkout with remote `main`. Work directly on `main`; do not create feature branches.
2. Keep changes focused. Separate organization work from behavior changes and dependency upgrades.
3. Update documentation and `.env.example` when contracts or required variables change.
4. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build` from the root. For database changes, run the relevant SQL tests against a prepared local instance.
5. Commit and push directly to `main` after checks pass. Do not open pull requests unless the owner explicitly changes this workflow. Record validation and any migration or rollback steps in the commit or accompanying documentation.

Write commit messages that explain intent, such as `docs: document local development` or `fix: restore expired session navigation`. Reviewers should understand a change without access to an external conversation.

## Database and security

Add new migrations using the existing `<timestamp>_<description>.sql` pattern. Do not rename, reorder, or rewrite applied migrations. When authorization changes, include regressions for anonymous access, permissions, and account boundaries.

`seed.sql` contains development data. Keep personal information, credentials, and production exports out of fixtures, screenshots, and reports. Follow [SECURITY.md](SECURITY.md) when reporting security issues.

## Review expectations

Include screenshots for interface changes and describe affected loading, error, and empty states. Distinguish completed checks from pending verification. Before pushing, confirm documentation links resolve and documented commands match package manifests.
