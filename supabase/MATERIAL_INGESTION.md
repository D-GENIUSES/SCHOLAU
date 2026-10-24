# Material ingestion (Gemini + R2)

**Lecturers** upload at `/lecturer/materials` (assigned published offerings). **Administrators** upload at `/admin/materials` (any published offering). Both use the same pipeline: bytes go to **Cloudflare R2** under `course-materials/{sha256}.{ext}`; **Gemini** on the server produces structured lesson/question JSON imported as drafts; Postgres stores job metadata only (not file blobs).

Authorization: `private.can_manage_ingestion_for_offering` — approved lecturer with assignment, or any admin. Course picker: `get_material_ingestion_offerings_v1`.

## Environment (apps/web)

- `GEMINI_API_KEY` — Google AI Studio / Gemini Developer API (optional; stub generator used when unset)
- `GEMINI_MODEL` — default `gemini-3-flash-preview` (override if your API tier lists a different model)
- `INGESTION_WORKER_SECRET` — shared secret for `POST /api/material-ingestion/worker`
- R2 variables (see `docs/operations/r2-storage.md`)

## Worker wake (hosted)

Set Vault secrets (same pattern as push):

- `ingestion_worker_url` — e.g. `https://your-app/api/material-ingestion/worker`
- `ingestion_worker_secret` — matches `INGESTION_WORKER_SECRET`

Cron job `scholau-ingestion-recovery` calls `private.wake_ingestion_worker()` each minute when `pg_cron` is available.

Local dev: upload triggers an inline fetch to the worker when `INGESTION_WORKER_SECRET` is set.

### Smoke / E2E scripts (apps/web)

```bash
node --env-file=.env.local scripts/local-ingestion-smoke.mjs
node --env-file=apps/web/.env.local apps/web/scripts/run-local-ingestion-e2e.mjs   # from repo root
```

## Flow

1. `create_material_ingestion_job_v1` — dedupe by `(course_id, sha256)` for succeeded jobs
2. Worker claims job, reads R2, calls Gemini (or stub), `service_ingestion_import_v1` → draft lessons/questions
3. Admin publishes via `/admin/review`

## Dedup

- **File SHA:** succeeded job for `(course_id, sha256)` returns `duplicate_file` unless `forceReprocess`.
- **Content fingerprint:** worker skips import when the same fingerprint was recorded in `material_ingestion_evidence`.
- **Logical keys:** questions with an existing `logical_question_key` on the course are skipped on re-ingestion.

Evidence rows power the admin review “Ingestion evidence” snippets.
