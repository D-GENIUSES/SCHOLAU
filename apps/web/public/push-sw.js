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

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let message;
    try { message = event.data?.json(); } catch { return; }
    if (!message || typeof message.id !== "string" || !message.device_key || !Number.isFinite(Date.parse(message.expires_at)) || Date.parse(message.expires_at) <= Date.now()) return;
    // Disabling this device also suppresses messages already accepted by the push provider.
    if (!(await deviceEnabled(message.device_key))) return;
    await self.registration.showNotification(String(message.title || "ScholAu").slice(0, 100), {
      body: String(message.body || "You have an update in ScholAu.").slice(0, 500),
      icon: "/icons/pwa-icon-192.png", badge: "/icons/pwa-icon-192.png",
      tag: "scholau:" + message.id, renotify: false,
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
