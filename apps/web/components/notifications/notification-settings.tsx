"use client";
import { InlineSkeleton } from "@/components/ui/misc";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useNotificationSettings } from "@scholau/api/react";
import { Bell, BellOff } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { disableBrowserPush, enableBrowserPush, readPushDevice } from "@/lib/push-browser";

function subscribeSound(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("scholau-sound", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("scholau-sound", callback); };
}
function soundEnabled() {
  try { return localStorage.getItem("scholau.notification-sound") !== "off"; } catch { return true; }
}
export function NotificationSettings({ owner }: { owner: string }) {
  const settings = useNotificationSettings();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const sound = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  const [active, setActive] = useState(false);
  useEffect(() => {
    // Local state alone is insufficient after browser permission is revoked.
    let cancelled = false;
    async function check() {
      const device = readPushDevice();
      const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration("/") : undefined;
      const subscription = await registration?.pushManager.getSubscription();
      const allowed = "Notification" in window && Notification.permission === "granted";
      if (!cancelled) setActive(Boolean(device?.owner === owner && subscription && allowed));
    }
    void check().catch(() => undefined);
    return () => { cancelled = true; };
  }, [owner]);
  if (settings.isPending) return <LoadingState variant="settings" label="Loading notifications…" />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
  const savedDevice = readPushDevice();
  const serverActive = settings.data.devices.some((device) => device.device_key === savedDevice?.key && device.active);
  const enabled = active && serverActive;
  async function change(enable: boolean) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      if (enable) await enableBrowserPush(settings.data!.vapid_public_key, owner);
      else await disableBrowserPush();
      setActive(enable);
      await settings.refetch();
      setMessage(enable ? "All notifications are enabled on this device." : "Notifications are off on this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update notifications. Please try again.");
    } finally { setBusy(false); }
  }
  return <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-line bg-surface-card" aria-labelledby="device-title" aria-busy={busy}>
    <div className="p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${enabled ? "bg-brand-primary/10 text-brand-primary" : "bg-surface-page text-ink-muted"}`}>
            {enabled ? <Bell className="size-4" aria-hidden /> : <BellOff className="size-4" aria-hidden />}
          </span>
          <div className="min-w-0">
            <span className="block text-[10px] font-semibold text-ink-muted">This device</span>
            <h2 id="device-title" className="text-sm font-semibold text-ink">Push notifications</h2>
            <p id="device-description" className="mt-0.5 text-xs leading-snug text-ink-muted wrap-anywhere">Grouped course updates, with quiet hours from 10 p.m. to 8 a.m.</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Notifications on this device"
          aria-describedby="device-description"
          disabled={busy || (!enabled && !settings.data.push_available)}
          onClick={() => void change(!enabled)}
          className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-transparent transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none ${enabled ? "bg-brand-primary" : "bg-slate-300"}`}
        >
          <span className={`size-4 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${enabled ? "translate-x-5" : "translate-x-1"}`}>
            {busy ? <InlineSkeleton /> : null}
          </span>
        </button>
      </div>
    </div>
    <div className="flex min-w-0 items-center gap-2 border-t border-line bg-surface-page/50 px-3 py-2 text-xs text-ink-muted">
      <span className={`size-1.5 shrink-0 rounded-full ${enabled ? "bg-brand-primary" : "bg-slate-400"}`} aria-hidden />
      <span className="min-w-0">{busy ? "Updating…" : enabled ? "On · You’re all set" : "Off · Turn on whenever you’re ready"}</span>
    </div>
    <div className="flex flex-wrap items-center gap-2 border-t border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
      <label className="flex items-center gap-2"><input type="checkbox" checked={sound} onChange={(event) => {
        try { localStorage.setItem("scholau.notification-sound", event.target.checked ? "on" : "off"); window.dispatchEvent(new Event("scholau-sound")); }
        catch { setMessage("Your browser could not save sound preferences. Check site storage permissions."); }
      }} />In-app sound</label>
      <button type="button" className="rounded-md border border-blue-200 bg-white px-2 py-1 font-semibold" onClick={() => {
        const audio = new Audio("/sounds/scholau-notification.wav"); audio.volume = 0.35;
        void audio.play().catch(() => setMessage("Your browser could not play the preview. Check your device sound settings."));
      }}>Preview sound</button>
      <p className="w-full text-xs">Sound plays while the app is open. Background alerts use your device settings.</p>
    </div>
    {!settings.data.push_available ? <p className="px-3 py-2 text-xs text-ink-muted">Notifications are temporarily unavailable. Your inbox is still available.</p> : null}
    {message ? <p role="status" aria-live="polite" className="px-3 py-2 text-xs">{message}</p> : null}
    {!enabled ? <p className="px-3 py-2 text-xs leading-relaxed text-ink-muted">If blocked, allow notifications in your browser’s site settings, then switch them on here.</p> : null}
  </section>;
}
