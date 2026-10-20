# Blue-only launch and installed-app updates

Production baseline: `13c35a4a7bfbcc15691b60088d24f7d60d113d5c` on `staging`, project `scholau`, alias `scholau.vercel.app`. This change contains only launch branding and installed-app update delivery.

## What changes

The only document splash is the server-rendered blue orbit animation. The manifest keeps its original `/home` start URL and `/` scope so existing installations retain their identity. Versioned v4 blue launch icons are referenced by the manifest; the legacy icon URLs also serve blue artwork. Thirty-six matching portrait/landscape Apple startup images are supplied. No splash code uses the legacy v1 session key or CSS classes.

The root service worker retains the same URL and scope, preserving push subscriptions. Registration and update checks no longer depend on notification consent or authentication. Activation removes stale cached HTML and old launch entries, retaining unrelated API data and other origins. Navigations use the network without cached HTML; the offline fallback contains its own blue branding and animation. Login cookies, localStorage and IndexedDB are not cleared. Push handling is preserved.

Every active visible client checks `/api/app-version` without HTTP/CDN caching every 15 seconds and on focus, pageshow, visibility restoration and reconnect. The public response contains only a release ID and splash revision; it bypasses authentication refresh. The initial document includes the same release ID. The browser reloads when it detects a different deployed version and the page is safe. It defers during a live attempt, battle/queue, modified form, active input, dialog or pending save; the user sees that an update is ready. Requests time out after eight seconds and retry later. Polling and listeners are cleaned up when the component unmounts.

## Limits

Fifteen seconds is the normal check interval while visible and connected, not a guaranteed delivery deadline. Suspended, closed or offline clients cannot be forced to fetch an update. Browser/OS-owned WebAPK metadata, icons and native launch snapshots update on platform-specific schedules. In particular, some existing iOS installations may require reinstalling to replace native metadata. The web app cannot animate or retroactively rewrite an OS-owned startup snapshot. Reopening online retrieves the current document and worker. Existing old JavaScript gains the new updater when it first loads this release; no claim is made that a closed old client can be remotely rewritten.

## Verification

`node scripts/check-splash.mjs` runs in CI and before every application build. It rejects legacy splash code, non-blue manifest references, missing startup images, changed installed identity and regressions in legacy icon URLs.

`node --test scripts/splash-update.test.mjs` verifies 15-second checks, automatic application, foreground restoration, reconnection, activity/form protection, failed-endpoint and rollback handling, cleanup, worker activation, selective cache cleanup, fresh navigation, offline blue fallback and private API isolation. Lint, TypeScript and production compilation are also required. Physical iOS/Android installation metadata cannot be validated from this desktop environment.
