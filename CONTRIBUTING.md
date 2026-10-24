# Contributing to SCHOLAU

## Preparation

Follow [Getting started](README.md#getting-started), use pnpm 12.11.2, and read the `AGENTS.md` files applicable to the directories you change. The [architecture guide](docs/architecture.md) explains where each kind of change belongs.

## Workflow

1. Create a branch from an up-to-date `main`. Use a descriptive name such as `feat/course-search`, `fix/session-expiry`, or `docs/setup`.
2. Keep changes focused. Separate organization work from behavior changes and dependency upgrades.
3. Update documentation and `.env.example` when contracts or required variables change.
4. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build` from the root. For database changes, run the relevant SQL tests against a prepared local instance.
5. Open a pull request explaining the problem, resulting behavior, validation, and any migration or rollback steps.

Write commit messages that explain intent, such as `docs: document local development` or `fix: restore expired session navigation`. Reviewers should understand a change without access to an external conversation.

## Database and security

Add new migrations using the existing `<timestamp>_<description>.sql` pattern. Do not rename, reorder, or rewrite applied migrations. When authorization changes, include regressions for anonymous access, permissions, and account boundaries.

`seed.sql` contains development data. Keep personal information, credentials, and production exports out of fixtures, screenshots, and reports. Follow [SECURITY.md](SECURITY.md) when reporting security issues.

## Review expectations

Include screenshots for interface changes and describe affected loading, error, and empty states. Distinguish completed checks from pending verification. Before merging, confirm documentation links resolve and documented commands match package manifests.
