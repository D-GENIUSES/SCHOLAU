# Security

## Credentials and data

Keep secrets out of Git. Use `apps/web/.env.local` for local web development and the hosting platform's secret manager for deployed environments. `.env.example` must contain only variable names and example values.

`NEXT_PUBLIC_*` variables are public. Supabase secret or service-role keys and R2 credentials belong exclusively on the server. Enforce authorization in the backend; hiding interface elements is not an access control.

If a credential is published, revoke or rotate it, determine its scope, and review access logs. Removing a file from the latest commit does not remove its contents from Git history.

## Reporting a vulnerability

Do not post credentials, personal data, or exploitation instructions in a public issue. Use the repository's Security section if a private reporting channel is available. Otherwise, arrange a private channel with the maintainers before sharing details.

Include the affected revision, impact, access requirements, and reproduction steps using synthetic data. This document does not establish a response-time commitment or a bug bounty programme.
