# SCHOLAU

A university learning platform that connects each student's academic curriculum with lessons, assessments, and competitive learning. This monorepo contains the web application, shared packages, and the database schema and access rules.

Content access follows the student's university, programme, level, and semester. PostgreSQL enforces authorization, progress, and reward rules; the application consumes those contracts through a shared API layer.

## Capabilities

| Area | Scope |
| --- | --- |
| Identity | Registration, email verification, account recovery, and academic profiles. |
| Learning | Course offerings, lessons, and progress tracking. |
| Assessment | Review, practice, mock exams, and result review. |
| Competition | Battles, invitations, history, XP, and leaderboards. |
| Teaching | Lecturer registration requests and approved lecturer access. |
| Administration | Content review and publication, imports, user management, reports, and auditing. |
| Privacy | Access controls, private assets, and account erasure. |

Features present in source are not necessarily deployed to production. Lessons and assessments require published content and appropriate access. Development fixtures do not represent production academic content.

## Architecture

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Application | Next.js, React, TypeScript | Routes, interface, sessions, and server endpoints. |
| Client data | TanStack Query, `@scholau/api` | Queries, mutations, data contracts, and realtime updates. |
| Domain | `@scholau/core`, Zod | Shared types, validation, and domain utilities. |
| Design | Tailwind CSS, `@scholau/tokens` | Visual tokens, styles, and design foundations. |
| Backend | Supabase, PostgreSQL | Authentication, RPCs, access policies, and persistence. |
| Assets | Supabase Storage, Cloudflare R2 | Private lesson assets, selected through server configuration. |
| Workspace | pnpm workspaces, Turborepo | Dependency management and cross-package tasks. |

The web application imports shared packages through `@scholau/*`. SQL migrations define the persistent schema and business rules. See [architecture and package boundaries](docs/architecture.md).

## Repository layout

```text
SCHOLAU/
├── .github/                 # CI workflows and collaboration templates
├── apps/
│   └── web/
│       ├── app/             # Next.js routes, layouts, and HTTP endpoints
│       ├── components/      # Components grouped by domain
│       ├── lib/             # Application integrations and utilities
│       ├── public/          # Browser-served static assets
│       └── scripts/         # Web-specific operational scripts
├── assets/
│   └── brand/               # Brand source assets and manifest
├── docs/
│   ├── features/            # Feature behavior and business rules
│   └── operations/          # Storage and operational guides
├── packages/
│   ├── api/                 # Data client, contracts, and hooks
│   ├── core/                # Domain types, schemas, and utilities
│   └── tokens/              # Shared visual tokens and styles
├── supabase/
│   ├── curricula/           # Academic catalogues, sources, and reconciliation
│   ├── migrations/          # Ordered SQL migration history
│   ├── tests/database/      # Database integration and security tests
│   ├── config.toml          # Local service configuration
│   └── seed.sql             # Development fixtures
├── CONTRIBUTING.md
├── SECURITY.md
├── pnpm-workspace.yaml
└── turbo.json
```

Runtime paths and migrations retain their existing locations. Historical guide paths in the root and `supabase/` link to their canonical documents in `docs/`.

## Getting started

### Prerequisites

- Git and Node.js. The manifest accepts Node.js 20.9 and newer; CI uses Node.js 24.
- pnpm **12.11.2**, as declared in `package.json`.
- A development Supabase project, or Supabase CLI and Docker for a local instance.

Use the pnpm version declared by the repository. If your installation includes Corepack, run `corepack enable` to respect the `packageManager` field. Alternatively, install that pnpm version directly.

### Installation

```bash
git clone https://github.com/D-GENIUSES/SCHOLAU.git
cd SCHOLAU
pnpm install --frozen-lockfile
```

Copy `apps/web/.env.example` to `apps/web/.env.local`, then configure your development environment.

PowerShell:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
```

macOS or Linux:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Start development from the repository root:

```bash
pnpm dev
```

The web application normally runs at `http://localhost:3000`. Public navigation can render without a session. Authenticated workflows require a configured Supabase instance and an account with the appropriate permissions.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Development Supabase instance URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon or publishable key for the same project. |
| `NEXT_PUBLIC_APP_BUILD` | Build number used for compatibility checks. |
| `SUPABASE_SECRET_KEY` | Server-only credential for administrative operations. `SUPABASE_SERVICE_ROLE_KEY` is also supported as a fallback. |
| `LESSON_ASSET_STORAGE` | Lesson image provider: `supabase` or `r2`. |
| `R2_ACCOUNT_ID`, `R2_BUCKET` | R2 account and bucket when using that provider. |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Private R2 credentials, available only to the server. |

[`.env.example`](apps/web/.env.example) is the configuration reference. Variables prefixed with `NEXT_PUBLIC_` may reach the browser and must never contain privileged credentials. Keep environment files and private values out of Git.

### Local database

From the repository root, with Supabase CLI and Docker available:

```bash
supabase start
supabase status
```

Configure the application with the local instance URL and public key. To rebuild a disposable local database and load `seed.sql`:

```bash
supabase db reset --local
supabase test db
```

`db reset --local` deletes data in that local instance. Some migrations depend on scheduled jobs and extensions; confirm compatibility with your Supabase environment. Read the [backend guide](supabase/README.md) before preparing database changes.

## Development commands

Run workspace tasks from the repository root.

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start workspace development servers. |
| `pnpm lint` | Run web ESLint and the checks declared by shared packages. |
| `pnpm typecheck` | Generate route types and check TypeScript across workspaces. |
| `pnpm build` | Compile the application and run task dependencies. |
| `pnpm --filter @scholau/web start` | Serve an existing production web build. |
| `supabase test db` | Run SQL tests against a prepared local database. |

GitHub Actions installs dependencies with the frozen lockfile, then runs lint, type checking, and a production build. CI does not deploy the application or modify a database. SQL tests run separately and require a prepared instance.

## Technical documentation

| Guide | Contents |
| --- | --- |
| [Documentation index](docs/README.md) | Entry point for technical guides. |
| [Architecture](docs/architecture.md) | Dependencies, boundaries, and where new code belongs. |
| [Contributing](CONTRIBUTING.md) | Development, review, and validation workflow. |
| [Security](SECURITY.md) | Credential handling and vulnerability reporting. |
| [Backend](supabase/README.md) | Migrations, tests, and academic data. |
| [R2 storage](docs/operations/r2-storage.md) | Private access, asset migration, and rollback. |
| [Account erasure](docs/features/account-erasure.md) | Deletion scope and lifecycle. |
| [Lecturer registration](docs/features/lecturer-registration.md) | Applications and lecturer authorization. |
| [Social battles](docs/features/social-battles.md) | Competition rules and access. |
| [XP](docs/features/xp.md) | Progress and reward rules. |
| [Academic catalogues](supabase/curricula/README.md) | Sources, requirements, and programme mapping. |

## Changes and releases

Work on a branch and open a pull request describing the problem, resulting behavior, and validation. Add schema changes as new migrations; do not rewrite applied migrations to change production behavior.

Web deployment, database migrations, and secret provisioning are separate operations. Before releasing, review server variables, authentication redirect URLs, and application compatibility with the target schema. A successful build alone does not verify authenticated production workflows.
