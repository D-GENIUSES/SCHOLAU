"use client";

import { parseRpcError } from "@scholau/api";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const PUSH_DEVICE_CACHE = "scholau-push-device";
const PUSH_DEVICE_PATH = "/__scholau/push-device";

export type PushDeviceState = { key: string; owner: string; enabled: boolean; vapidPublicKey?: string };

export function pushSupportMessage(): string | null {
  if (!window.isSecureContext) return "Notifications need a secure HTTPS connection.";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios && !window.matchMedia("(display-mode: standalone)").matches && !(navigator as Navigator & { standalone?: boolean }).standalone) return "On iPhone or iPad, use Share → Add to Home Screen, open ScholAu from that icon, then enable notifications.";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "This browser does not support push notifications. Your inbox is still available.";
  if (Notification.permission === "denied") return "Open this site’s browser settings, change Notifications from Block to Allow, then return and tap Enable notifications.";
  return null;
}

function applicationServerKey(publicKey: string) {
  const normalized = publicKey.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

async function subscribePush(registration: ServiceWorkerRegistration, publicKey: string) {
  try {
    return await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
  } catch {
    const old = await registration.pushManager.getSubscription();
    if (old) await old.unsubscribe();
    return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
  }
}

export async function setLocalPushDevice(value: PushDeviceState) {
  try {
    const cache = await caches.open(PUSH_DEVICE_CACHE);
    await cache.put(new URL(PUSH_DEVICE_PATH, location.origin).href, new Response(JSON.stringify(value), {
      headers: { "Content-Type": "application/json" },
    }));
  } catch { /* Cache Storage is best-effort; IndexedDB still covers same-origin workers. */ }
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("scholau-push", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("settings");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("settings", "readwrite");
        transaction.objectStore("settings").put(value, "device");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } finally { db.close(); }
  } catch { /* Closed-app delivery can use Cache Storage alone if IndexedDB is blocked. */ }
}

export async function disableBrowserPush(revoke = true) {
  if (revoke) localStorage.removeItem("scholau.push.signup.v1");
  const saved = localStorage.getItem("scholau.push.device.v1");
  const device: { key: string; owner: string } | null = saved ? JSON.parse(saved) : null;
  if (device) await setLocalPushDevice({ ...device, enabled: false });
  let revokeError: Error | null = null;
  if (device && revoke) {
    const { error } = await getBrowserSupabase().rpc("revoke_push_token_v1", { p_platform: "web", p_device_key: device.key });
    if (error) revokeError = new Error("This device is disabled locally. Reconnect and disable again to finish server revocation.");
  }
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
    for (const notification of await registration?.getNotifications() ?? []) notification.close();
  }
  if (revokeError) throw revokeError;
  localStorage.removeItem("scholau.push.device.v1");
  localStorage.removeItem("scholau.push.endpoint.v1");
}

export async function enableBrowserPush(publicKey: string, owner: string) {
  const reason = pushSupportMessage();
  if (reason) {
    if ("Notification" in window && Notification.permission === "denied") postponePushPermission(owner);
    throw new Error(reason);
  }
  if (!publicKey) throw new Error("Notification delivery is being configured. Please try again later.");
  // Keep the permission request directly attached to the user's click (required on Safari).
  if (Notification.permission !== "granted" && await Notification.requestPermission() !== "granted") {
    postponePushPermission(owner);
    throw new Error("Notifications were not enabled. You can keep using your inbox.");
  }
  const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/", updateViaCache: "none" });
  await navigator.serviceWorker.ready;
  const subscription = await subscribePush(registration, publicKey);
  const existing = readPushDevice();
  const device = existing?.owner === owner ? existing : { key: crypto.randomUUID(), owner };
  try {
    const { error } = await getBrowserSupabase().rpc("enable_all_notifications_v1", {
      p_owner_id: owner, p_device_key: device.key, p_delivery_config: subscription.toJSON(),
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos",
    });
    if (error) {
      const details = subscription.toJSON();
      // Provider hostname and lengths only: never log an endpoint or encryption keys.
      console.warn("ScholAu push registration rejected", JSON.stringify({
        code: error.code, reason: error.hint || error.message,
        provider: new URL(subscription.endpoint).hostname,
        publicKeyLength: details.keys?.p256dh?.length, authKeyLength: details.keys?.auth?.length,
      }));
      throw parseRpcError(error);
    }
    const { data } = await getBrowserSupabase().auth.getSession();
    if (data.session?.user.id !== owner) throw new Error("Sign in again to enable notifications.");
    localStorage.setItem("scholau.push.device.v1", JSON.stringify({ ...device, vapidPublicKey: publicKey }));
    localStorage.setItem("scholau.push.endpoint.v1", subscription.endpoint);
    await setLocalPushDevice({ ...device, enabled: true, vapidPublicKey: publicKey });
    localStorage.removeItem("scholau.push.signup.v1");
    localStorage.removeItem(`scholau.push.permission.v1:${owner}`);
    window.dispatchEvent(new Event("scholau-push-consent"));
  } catch (error) { await subscription.unsubscribe(); throw error; }
}


export function readPushDevice(): { key: string; owner: string; vapidPublicKey?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(localStorage.getItem("scholau.push.device.v1") || "null");
    if (typeof saved?.key !== "string" || typeof saved?.owner !== "string") return null;
    return typeof saved.vapidPublicKey === "string" ? saved : { key: saved.key, owner: saved.owner };
  } catch { return null; }
}

export async function requestSignupNotifications(owner: string): Promise<boolean> {
  if (pushSupportMessage()) {
    if ("Notification" in window && Notification.permission === "denied") postponePushPermission(owner);
    return false;
  }
  // No awaits/network calls before the native prompt: this runs from Continue.
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") { postponePushPermission(owner); return false; }
  localStorage.removeItem(`scholau.push.permission.v1:${owner}`);
  localStorage.setItem("scholau.push.signup.v1", JSON.stringify({ owner, requestedAt: Date.now() }));
  return true;
}

const repairs = new Map<string, Promise<void>>();
/** Keep an already-allowed device subscribed so alerts continue after the app is closed. */
export function maintainBrowserPush(owner: string): Promise<void> {
  if (repairs.has(owner)) return repairs.get(owner)!;
  const attempt = async () => {
    if (pushSupportMessage() || !("Notification" in window) || Notification.permission !== "granted") return;
    const device = readPushDevice();
    if (!device || device.owner !== owner) return;
    const client = getBrowserSupabase();
    const { data: sessionData } = await client.auth.getSession();
    if (sessionData.session?.user.id !== owner) return;
    const registration = await navigator.serviceWorker.getRegistration("/")
      ?? await navigator.serviceWorker.register("/push-sw.js", { scope: "/", updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription && localStorage.getItem("scholau.push.endpoint.v1") === subscription.endpoint) {
      await setLocalPushDevice({ key: device.key, owner: device.owner, enabled: true, vapidPublicKey: device.vapidPublicKey });
      return;
    }
    const { data, error } = await client.rpc("get_notification_preferences_v1");
    if (error || !data?.push_available || !data?.vapid_public_key) return;
    await enableBrowserPush(data.vapid_public_key, owner);
  };
  const promise = attempt().finally(() => repairs.delete(owner));
  repairs.set(owner, promise);
  return promise;
}

const enrollments = new Map<string, Promise<void>>();
export function enrollPendingNotifications(owner: string): Promise<void> {
  if (enrollments.has(owner)) return enrollments.get(owner)!;
  const attempt = async () => {
    let pending: { owner?: string; requestedAt?: number } | null;
    try { pending = JSON.parse(localStorage.getItem("scholau.push.signup.v1") || "null"); }
    catch { localStorage.removeItem("scholau.push.signup.v1"); return; }
    if (!pending || pending.owner !== owner) return;
    if (typeof pending.requestedAt !== "number" || Date.now() - pending.requestedAt > 7 * 86400000) {
      localStorage.removeItem("scholau.push.signup.v1"); return;
    }
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const client = getBrowserSupabase();
    const { data: sessionData } = await client.auth.getSession();
    if (sessionData.session?.user.id !== owner) return;
    const { data, error } = await client.rpc("get_notification_preferences_v1");
    if (error || !data?.push_available || !data?.vapid_public_key) throw new Error("Notifications are temporarily unavailable.");
    await enableBrowserPush(data.vapid_public_key, owner);
  };
  const promise = attempt().finally(() => enrollments.delete(owner));
  enrollments.set(owner, promise);
  return promise;
}

const PERMISSION_REMINDER_INTERVAL = 86400000;
export function readPushPermissionReminder(owner: string): { nextAskAt: number } | null {
  try {
    const value = JSON.parse(localStorage.getItem(`scholau.push.permission.v1:${owner}`) || "null");
    return typeof value?.nextAskAt === "number" && Number.isFinite(value.nextAskAt) ? value : null;
  } catch { return null; }
}
export function postponePushPermission(owner: string) {
  localStorage.setItem(`scholau.push.permission.v1:${owner}`, JSON.stringify({ nextAskAt: Date.now() + PERMISSION_REMINDER_INTERVAL }));
}
