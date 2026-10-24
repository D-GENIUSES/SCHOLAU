# Notification pacing and branding

Course publication fan-out groups lessons and assessments for the same student and course into a single inbox summary for 30 minutes. The first push waits five minutes so upload batches settle. Retries retain event-key deduplication. A summary checks current course enrollment before delivery.

Every push category shares a per-subscription 30-minute reservation in the database. Concurrent workers lock this reservation before authorizing a send. Deferred jobs retain their retry budget; expiry, revocation, read state, relevance, preferences and provider backoff still apply. Existing quiet-hour preferences are respected (default 22:00–08:00 in the saved timezone). This can defer or expire short-lived battle invitations; they remain available in the app.

The service worker also stores a device cooldown in IndexedDB. Buffered pushes within that interval are silent, and course pushes replace one grouped notification card. The icon is a white ScholAu mark on blue, with a separate transparent monochrome status badge. Native notification card colors are controlled by the OS/browser.

While the app is visible, one visible window receives the gentle ScholAu chime and the system notification is silent to prevent two sounds. Browser media restrictions may require prior interaction. Notification settings provide a sound preview and a persistent device mute for this in-app chime. Background sound follows device/browser settings; custom background notification audio is not supported by Web Push.

Icon comparison assets are `/icons/scholau-blue-white.png` and `/icons/scholau-mixed-blue-white.png`. Only the notification icon changes in this release; app installation icons await selection.

Apply migration `20261020001100_calm_course_notifications.sql` before releasing the web app. It stops existing pending course publication recipients and queued course pushes to avoid replaying a bulk-upload backlog; existing inbox records and learning content remain. New uploads create grouped summaries. No edge function change is required. Existing devices refresh their service worker on app entry.

Validation: database grouping, retry deduplication, delayed delivery, shared cooldown, retry budget, enrollment revocation and worker permissions; existing Web Push regressions; browser checks using real IndexedDB for concurrent buffered pushes, expiry, foreground sound handoff and disabled devices; TypeScript and lint checks.
