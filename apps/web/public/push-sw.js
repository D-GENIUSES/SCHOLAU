/* Only handles push; authenticated pages and API responses are never cached. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function deviceEnabled(deviceKey) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("scholau-push", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("settings");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("settings").objectStore("settings").get("device");
      request.onsuccess = () => resolve(request.result?.key === deviceKey && request.result?.enabled === true);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function reserveAlert(deviceKey, id) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("scholau-push", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("settings");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("settings", "readwrite");
      const store = transaction.objectStore("settings");
      const request = store.get("alert:" + deviceKey);
      let allowed = false;
      request.onsuccess = () => {
        const prior = request.result;
        allowed = prior?.id !== id && (!prior || Date.now() - prior.at >= 30 * 60 * 1000);
        if (allowed) store.put({ id, at: Date.now() }, "alert:" + deviceKey);
      };
      transaction.oncomplete = () => resolve(allowed);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let message;
    try { message = event.data?.json(); } catch { return; }
    if (!message || typeof message.id !== "string" || !message.device_key || !Number.isFinite(Date.parse(message.expires_at)) || Date.parse(message.expires_at) <= Date.now()) return;
    // Disabling this device also suppresses messages already accepted by the push provider.
    if (!(await deviceEnabled(message.device_key))) return;
    const audible = await reserveAlert(message.device_key, message.id);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const foreground = windows.find((client) => client.visibilityState === "visible");
    if (audible && foreground) foreground.postMessage({ type: "scholau-notification", deviceKey: message.device_key });
    await self.registration.showNotification(String(message.title || "ScholAu").slice(0, 100), {
      body: String(message.body || "You have an update in ScholAu.").slice(0, 500),
      icon: "/icons/notification-blue-192.png", badge: "/icons/notification-badge.png",
      tag: "scholau:" + (message.kind === "course_content" ? "course-updates" : message.id), renotify: false,
      silent: !audible || Boolean(foreground),
      data: { id: message.id, target: message.target },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const data = event.notification.data || {};
    // Route through an authenticated server page that verifies ownership and current access.
    const target = new URL("/notification-open/" + encodeURIComponent(data.id || "unknown"), self.location.origin);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(target.href); await existing.focus(); }
    else await self.clients.openWindow(target.href);
  })());
});
