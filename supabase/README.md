# Backend and data

| Path | Responsibility |
| --- | --- |
| `config.toml` | Local services, authentication, and ports. |
| `migrations/` | Ordered SQL history for the schema, RPCs, and policies. |
| `seed.sql` | Development fixtures, not production academic content. |
| `tests/database/` | SQL business-rule and security tests. |
| `curricula/` | Academic catalogues, sources, and verification records. |

Run Supabase CLI from the repository root. `supabase start` prepares local services; `supabase status` displays their configuration. `supabase db reset --local` rebuilds the local instance and deletes its data, so use it only with disposable data. After preparing the schema, run `supabase test db`.

Migrations include extensions and scheduled jobs. Review instance requirements before applying them; generic PostgreSQL is not equivalent to a complete Supabase environment. Never expose private schemas through the Data API.

Add schema changes as new migrations with regression coverage. Applying changes to a remote project requires review, a backup, and a recovery plan appropriate to the change.

Feature guides are listed in the [documentation index](../docs/README.md). Academic catalogues retain their [provenance documentation](curricula/README.md) alongside source data.
