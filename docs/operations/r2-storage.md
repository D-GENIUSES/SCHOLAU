# Lesson assets on Cloudflare R2

The private `scholau-assets` bucket holds lesson images under `lesson-assets/<course UUID>/<lesson UUID>/<filename>`. Database blocks retain their original paths. Supabase remains the database and authentication provider. Profile photos keep their existing PostgreSQL storage and account erasure behavior; migrating those requires a separate lifecycle change. PDF course catalogue data is structured database content, not a collection of downloadable PDFs.

## Server configuration

Set `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `LESSON_ASSET_STORAGE=r2` in the web server's secret environment. No R2 variable may have a `NEXT_PUBLIC_` prefix. Keep public access disabled and scope the token to object read/write for this bucket. Local secrets belong in ignored `apps/web/.env.local`. Configure the same secrets separately on the eventual hosting platform.

Apply `20261017000800_r2_lesson_asset_access.sql` before switching the web client. Run the migration script in inventory mode, then `--copy`, using server credentials. It recursively copies every existing lesson asset and verifies SHA-256 by downloading the destination. It never deletes sources and stops on conflicts. Pause manual storage writes while copying and switching providers. Re-running the script verifies existing objects without overwriting different bytes. Roll back by setting `LESSON_ASSET_STORAGE=supabase` and restarting the server; images added only to R2 must first be copied back for full rollback.

## Interfaces

- `GET /api/lesson-assets?path=...` checks the session and the existing published lesson, course enrollment and active account policy before returning `{ signedUrl, expiresIn: 3600 }`. Administrators retain preview access. Responses are private and never cached. R2 links are bearer links and remain usable until their one-hour expiry.
- `POST /api/lesson-assets?lessonId=<UUID>` accepts a multipart `file` from same-origin, active administrators only. It verifies that the lesson exists, limits the upload to 5 MB, decodes PNG/JPEG/WebP/GIF, and produces a WebP up to 2400 by 2400 pixels (the first frame for animated input). It returns `{ path, contentType, bytes }`. Reference that `path` in an image block through the existing import/review flow. Students cannot upload. Uploading does not publish an image.
- Credentials are used only in Node server code. No public bucket, Worker, custom domain or browser CORS configuration is needed for image rendering or server-proxied uploads.

Shared lesson images are institutional content and are not deleted when an uploader's account is erased. There is no automatic deletion or source purge in this rollout. Unreferenced uploads require administrator review before removal.
