export const UPDATE_INTERVAL_MS = 15_000;
/** @param {boolean} pending */
function ignorePending(pending) { void pending; }

/** Framework-independent lifecycle, tested with an installed-app browser adapter. */
export function startAppUpdates({ browser = navigator, page = document, events = window, currentVersion = "", onPending = ignorePending } = {}) {
  let disposed = false;
  let lastWorkerCheck = -Infinity;
  let checking = false;
  let nextVersion = "";
  let reloading = false;
  let edited = false;
  let editedPath = events.location.pathname + events.location.search;
  let interactedAt = -Infinity;
  let requestController;
  const markEdited = () => { edited = true; };
  const markInteraction = () => { interactedAt = Date.now(); };
  function safeToReload() {
    const location = events.location.pathname + events.location.search;
    if (location !== editedPath) { edited = false; editedPath = location; }
    const focused = page.activeElement;
    return !/^\/(?:attempts|battles)\/[^/]+\/?$/.test(events.location.pathname)
      && !edited && Date.now() - interactedAt > 3_000
      && !focused?.matches?.("input, textarea, select, [contenteditable=true]")
      && !page.querySelector?.('[aria-busy="true"], [role="dialog"]');
  }
  async function updateWorker() {
    if (!("serviceWorker" in browser) || Date.now() - lastWorkerCheck < 60_000) return;
    const registration = await browser.serviceWorker.register("/push-sw.js", { scope: "/", updateViaCache: "none" });
    if (!disposed) { await registration.update(); lastWorkerCheck = Date.now(); }
  }
  async function check() {
    if (disposed || checking || reloading || page.visibilityState === "hidden" || browser.onLine === false) return;
    checking = true;
    requestController = new AbortController();
    const timeout = events.setTimeout(() => requestController?.abort(), 8_000);
    let verified = false;
    try {
      if (currentVersion) {
        const response = await events.fetch("/api/app-version", { cache: "no-store", credentials: "omit", signal: requestController.signal });
        if (response.ok) {
          const data = await response.json();
          verified = typeof data.version === "string" && Boolean(data.version);
          if (verified && data.version !== currentVersion) nextVersion = data.version;
          else if (data.version === currentVersion) { nextVersion = ""; onPending(false); }
        }
      }
      if (disposed) return;
      void updateWorker().catch(() => {});
      if (nextVersion && verified) {
        if (safeToReload()) {
          // No storage changes: login, push subscriptions and saved progress survive.
          reloading = true;
          events.location.reload();
        } else onPending(true);
      }
    } catch { /* Retry when online/visible or at the next polling interval. */ }
    finally { events.clearTimeout(timeout); checking = false; }
  }
  void check();
  const interval = events.setInterval(() => void check(), UPDATE_INTERVAL_MS);
  const run = () => void check();
  events.addEventListener("online", run);
  events.addEventListener("pageshow", run);
  events.addEventListener("focus", run);
  events.addEventListener("popstate", run);
  page.addEventListener("visibilitychange", run);
  page.addEventListener("input", markEdited, true);
  page.addEventListener("change", markEdited, true);
  page.addEventListener("pointerdown", markInteraction, true);
  page.addEventListener("keydown", markInteraction, true);
  return () => {
    disposed = true; requestController?.abort();
    events.clearInterval(interval);
    for (const event of ["online", "pageshow", "focus", "popstate"]) events.removeEventListener(event, run);
    page.removeEventListener("visibilitychange", run);
    page.removeEventListener("input", markEdited, true);
    page.removeEventListener("change", markEdited, true);
    page.removeEventListener("pointerdown", markInteraction, true);
    page.removeEventListener("keydown", markInteraction, true);
  };
}
