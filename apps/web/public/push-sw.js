/* Blue-only launch, fresh navigation and existing push subscription support. */
const LAUNCH_REVISION = "blue-orbit-v4";
const OFFLINE_DOCUMENT = "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"theme-color\" content=\"#0866e8\"><title>ScholAu</title><style>html,body{margin:0;min-height:100%;background:#0866e8;color:white;font-family:system-ui}main{min-height:100dvh;display:grid;place-content:center;text-align:center;padding:24px;box-sizing:border-box}svg{width:236px;max-width:76vw;height:auto}a{color:white}p{font-size:14px}.spark{font-size:26px;animation:orbit 2s ease-in-out infinite}@keyframes orbit{0%,100%{transform:translateX(-90px)}50%{transform:translateX(90px)}}@media(prefers-reduced-motion:reduce){.spark{animation:none}}</style><main data-scholau-splash=\"blue-orbit\"><span class=\"spark\" aria-hidden=\"true\">\u2726</span><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"910\" height=\"240\" viewBox=\"0 0 910 240\" role=\"img\" aria-labelledby=\"title desc\"><title id=\"title\">ScholAu</title><desc id=\"desc\">Graduation cap and ribbon S with ScholAu wordmark. Vector redraw based on supplied references.</desc><defs><linearGradient id=\"blue\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop stop-color=\"#006FFF\"/><stop offset=\"1\" stop-color=\"#20B5EF\"/></linearGradient><linearGradient id=\"ribbon\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop stop-color=\"#168CFF\"/><stop offset=\"1\" stop-color=\"#0062E8\"/></linearGradient><linearGradient id=\"lower\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"0\"><stop stop-color=\"#31B8EF\"/><stop offset=\"1\" stop-color=\"#0876F5\"/></linearGradient></defs><g transform=\"translate(0 8) scale(.46)\"><path d=\"M248 32 Q256 28 264 32 L464 120 Q478 126 464 133 L264 222 Q256 226 248 222 L48 133 Q34 126 48 120 Z\" fill=\"#FFFFFF\"/><path d=\"M452 130 L452 223\" stroke=\"#FFFFFF\" stroke-width=\"17\" stroke-linecap=\"round\"/><rect x=\"438\" y=\"215\" width=\"28\" height=\"66\" rx=\"9\" fill=\"#FFFFFF\"/><path d=\"M284 239 L379 196 Q384 194 384 200 L384 280 Z\" fill=\"#FFFFFF\"/><path d=\"M110 197 C78 187 76 219 76 239 C75 266 83 282 112 296 L309 379 C365 403 359 447 321 466 L367 447 C400 433 417 409 414 380 C412 348 396 325 359 308 L136 214 C121 208 115 202 110 197 Z\" fill=\"#FFFFFF\"/><path d=\"M82 310 L279 396 C314 411 337 435 319 461 C308 477 294 481 274 475 L116 410 C90 399 82 385 82 359 Z\" fill=\"#FFFFFF\"/></g><g transform=\"translate(267 56.74228743416103) scale(0.9984449460747429) translate(-3.203125 -40.9375)\"><path d=\"M73.4375 59.453125L57.23633 73.75C51.54866 65.833336 45.756836 61.875 39.86084 61.875C36.99137 61.875 34.643555 62.643227 32.817383 64.17969C30.99121 65.71615 30.078125 67.447914 30.078125 69.375C30.078125 71.302086 30.730385 73.125 32.034912 74.84375C33.809 77.135414 39.156494 82.05729 48.077393 89.609375C56.42537 96.58854 61.486404 100.98958 63.260498 102.8125C67.6949 107.291664 70.83821 111.575516 72.69043 115.66406C74.54263 119.7526 75.46874 124.21875 75.46875 129.0625C75.46874 138.48958 72.210075 146.27603 65.69275 152.42188C59.175415 158.5677 50.676674 161.64062 40.196533 161.64062C32.010498 161.64062 24.880371 159.6354 18.806152 155.625C12.731934 151.61458 7.530924 145.3125 3.203125 136.71875L21.590576 125.625C27.120361 135.78125 33.48429 140.85938 40.682373 140.85938C44.438065 140.85938 47.593994 139.76562 50.150146 137.57812C52.7063 135.39062 53.984375 132.86458 53.984375 130C53.984375 127.39583 53.019203 124.791664 51.088867 122.1875C49.158524 119.58333 44.90641 115.59895 38.33252 110.234375C25.810547 100.02604 17.72359 92.14844 14.071655 86.60156C10.419718 81.05469 8.59375 75.520836 8.59375 70C8.59375 62.03125 11.631266 55.195312 17.706299 49.492188C23.78133 43.789062 31.27726 40.9375 40.19409 40.9375C45.93058 40.9375 51.39302 42.265625 56.58142 44.921875C61.769814 47.578125 67.388504 52.421875 73.4375 59.453125ZM177.1875 90.9375L159.43237 100.703125C156.09497 97.21354 152.79663 94.791664 149.53735 93.4375C146.27808 92.08333 142.4585 91.40625 138.07861 91.40625C130.1001 91.40625 123.64705 93.7854 118.71948 98.5437C113.79191 103.302 111.328125 109.399 111.328125 116.83472C111.328125 124.06372 113.70076 129.96622 118.446045 134.54224C123.19132 139.11824 129.4226 141.40625 137.1399 141.40625C146.68335 141.40625 154.11417 138.15103 159.43237 131.64062L176.25 143.15552C167.1354 155.01016 154.27083 160.9375 137.65625 160.9375C122.70833 160.9375 111.0026 156.5104 102.53906 147.65625C94.075516 138.80208 89.84375 128.4375 89.84375 116.5625C89.84375 108.33333 91.90104 100.7552 96.015625 93.828125C100.1302 86.90104 105.87239 81.45833 113.24219 77.5C120.61198 73.541664 128.85416 71.5625 137.96875 71.5625C146.40625 71.5625 153.98438 73.24219 160.70312 76.60156C167.42188 79.96094 172.91666 84.739586 177.1875 90.9375ZM196.48438 40.9375L217.65625 40.9375L217.65625 82.34375C221.8229 78.75 226.01562 76.05469 230.23438 74.25781C234.45312 72.46094 238.72395 71.5625 243.04688 71.5625C251.48436 71.5625 258.59372 74.479164 264.375 80.3125C269.3229 85.36458 271.79688 92.78645 271.79688 102.578125L271.79688 158.75L250.78125 158.75L250.78125 121.484375C250.78123 111.640625 250.31248 104.97395 249.375 101.484375C248.43748 97.99479 246.83592 95.390625 244.57031 93.671875C242.30469 91.953125 239.5052 91.09375 236.17188 91.09375C231.84895 91.09375 228.13802 92.52604 225.03906 95.390625C221.9401 98.2552 219.79166 102.16145 218.59375 107.109375C217.96875 109.66145 217.65625 115.49479 217.65625 124.609375L217.65625 158.75L196.48438 158.75ZM332.34375 71.5625C340.36456 71.5625 347.90363 73.56771 354.96094 77.578125C362.01822 81.58854 367.52603 87.03125 371.48438 93.90625C375.4427 100.78125 377.42188 108.203125 377.42188 116.171875C377.42188 124.1927 375.4297 131.6927 371.4453 138.67188C367.46094 145.65103 362.03125 151.10677 355.15625 155.03906C348.28125 158.97134 340.70312 160.9375 332.42188 160.9375C320.23438 160.9375 309.83072 156.60155 301.21094 147.92969C292.59113 139.25781 288.28125 128.72395 288.28125 116.328125C288.28125 103.046875 293.15103 91.979164 302.89062 83.125C311.43228 75.416664 321.25 71.5625 332.34375 71.5625ZM332.6953 91.640625C326.06934 91.640625 320.55215 93.94531 316.1438 98.55469C311.7354 103.16406 309.53125 109.0625 309.53125 116.25C309.53125 123.64583 311.70938 129.6354 316.06567 134.21875C320.42194 138.80208 325.93912 141.09375 332.6172 141.09375C339.29523 141.09375 344.85147 138.77603 349.2859 134.14062C353.72028 129.5052 355.93747 123.541664 355.9375 116.25C355.93747 108.95833 353.75934 103.03385 349.40308 98.47656C345.04678 93.919266 339.47754 91.640625 332.6953 91.640625ZM392.5 40.9375L413.82812 40.9375L413.82812 158.75L392.5 158.75ZM470.60547 43.828125L492.79053 43.828125L536.9922 158.75L514.2578 158.75L505.2661 135.07812L458.37402 135.07812L449.02344 158.75L426.28906 158.75ZM481.83594 74.296875L466.41968 113.75L497.1631 113.75ZM551.4844 73.75L573.0469 73.75L573.0469 114.6875C573.0469 122.65625 573.59515 128.1901 574.6918 131.28906C575.7883 134.38802 577.5504 136.79688 579.978 138.51562C582.4056 140.23438 585.39465 141.09375 588.9453 141.09375C592.4959 141.09375 595.5112 140.24739 597.99133 138.55469C600.4714 136.86197 602.3116 134.375 603.51196 131.09375C604.3998 128.64583 604.84375 123.41145 604.84375 115.390625L604.84375 73.75L626.1719 73.75L626.1719 109.765625C626.1719 124.609375 625 134.76562 622.65625 140.23438C619.7916 146.90103 615.5729 152.01822 610 155.58594C604.42706 159.15364 597.34375 160.9375 588.75 160.9375C579.42706 160.9375 571.888 158.85416 566.1328 154.6875C560.37756 150.52083 556.3281 144.71353 553.9844 137.26562C552.3177 132.10938 551.4844 122.734375 551.4844 109.140625Z\" fill=\"#FFFFFF\"/></g></svg><p>Unable to connect. Your saved progress is safe.</p><a href=\"/home\">Try again</a></main></html>";
const LEGACY_LAUNCH_PATHS = new Set(["/manifest.webmanifest", "/icon.svg", "/apple-icon.png", "/icons/pwa-icon-192.png", "/icons/pwa-icon-512.png", "/icons/pwa-maskable-512.png"]);
self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      const url = new URL(request.url);
      if (url.origin !== self.location.origin) continue;
      const response = await cache.match(request);
      if (request.mode === "navigate" || LEGACY_LAUNCH_PATHS.has(url.pathname) || response?.headers.get("content-type")?.includes("text/html")) await cache.delete(request);
    }
  }
  await self.clients.claim();
})()));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: "no-store" });
        if (response.status < 500) return response;
      } catch { /* Never fall back to cached legacy application HTML. */ }
      return new Response(OFFLINE_DOCUMENT, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Scholau-Launch": LAUNCH_REVISION } });
    })());
  } else if (url.pathname === "/api/app-version" || LEGACY_LAUNCH_PATHS.has(url.pathname)) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
  }
});

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
