export function allowedEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash &&
      (new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]).has(url.hostname) ||
        (url.hostname === "jmt17.google.com" && /^\/fcm\/send\/[A-Za-z0-9_/?=&%+.:~-]+$/.test(url.pathname + url.search)) ||
        /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname));
  } catch { return false; }
}

export function retryAfterSeconds(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - now) / 1000);
  return Number.isFinite(seconds) ? Math.max(30, Math.min(86400, seconds)) : null;
}
