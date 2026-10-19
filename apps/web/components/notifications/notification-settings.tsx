"use client";

import { useEffect, useState } from "react";
import { useNotificationSettings } from "@scholau/api/react";
import { Bell, BellOff, LoaderCircle, Volume2, VolumeX } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { disableBrowserPush, enableBrowserPush, readPushDevice } from "@/lib/push-browser";
import { notificationSoundEnabled, setNotificationSoundEnabled } from "@/lib/notification-sound";

export function NotificationSettings({ owner }: { owner: string }) {
  const settings = useNotificationSettings();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
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
  if (settings.isPending) return <div className="grid gap-4"><LoadingState label="Loading notifications…" /><SoundPreference /></div>;
  if (settings.isError) return <div className="grid gap-4"><ErrorState error={settings.error} onRetry={() => void settings.refetch()} /><SoundPreference /></div>;
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
  return <div className="grid gap-4"><section className="overflow-hidden rounded-3xl border border-line bg-surface-card shadow-sm" aria-labelledby="device-title" aria-busy={busy}>
    <div className="p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${enabled ? "bg-brand-primary/10 text-brand-primary" : "bg-surface-page text-ink-muted"}`}>
          {enabled ? <Bell className="size-5" aria-hidden /> : <BellOff className="size-5" aria-hidden />}
        </span>
        <span className="text-xs font-semibold uppercase tracking-widest text-ink-muted">This device</span>
      </div>
      <div className="flex items-center justify-between gap-5">
        <div className="min-w-0">
          <h2 id="device-title" className="text-lg font-bold text-ink">Push notifications</h2>
          <p id="device-description" className="mt-1 max-w-sm text-sm leading-relaxed text-ink-muted">Stay in the loop with updates from ScholAu.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Notifications on this device"
          aria-describedby="device-description"
          disabled={busy || (!enabled && !settings.data.push_available)}
          onClick={() => void change(!enabled)}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-transparent transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none ${enabled ? "bg-brand-primary" : "bg-slate-300"}`}
        >
          <span className={`flex size-6 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${enabled ? "translate-x-6" : "translate-x-1"}`}>
            {busy ? <LoaderCircle className="size-3.5 animate-spin text-brand-primary motion-reduce:animate-none" aria-hidden /> : null}
          </span>
        </button>
      </div>
    </div>
    <div className="flex items-center gap-2 border-t border-line bg-surface-page/50 px-5 py-3 text-xs text-ink-muted sm:px-6">
      <span className={`size-1.5 rounded-full ${enabled ? "bg-brand-primary" : "bg-slate-400"}`} aria-hidden />
      {busy ? "Updating…" : enabled ? "On · You’re all set" : "Off · Turn on whenever you’re ready"}
    </div>
    {!settings.data.push_available ? <p className="px-5 pb-4 pt-3 text-sm text-ink-muted">Notifications are temporarily unavailable. Your inbox is still available.</p> : null}
    {message ? <p role="status" aria-live="polite" className="px-5 pb-4 pt-3 text-sm">{message}</p> : null}
    {!enabled ? <p className="px-5 pb-4 pt-3 text-xs leading-relaxed text-ink-muted">Previously blocked? Set Notifications to Allow in your browser’s site settings, then switch them on here.</p> : null}
  </section><SoundPreference /></div>;
}

function SoundPreference() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => { setEnabled(notificationSoundEnabled()); }, []);
  return <section className="overflow-hidden rounded-3xl border border-line bg-surface-card shadow-sm" aria-labelledby="sound-title">
    <div className="flex items-center justify-between gap-5 p-5 sm:p-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${enabled ? "bg-brand-primary/10 text-brand-primary" : "bg-surface-page text-ink-muted"}`}>
          {enabled ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0">
          <h2 id="sound-title" className="text-lg font-bold text-ink">Sound</h2>
          <p id="sound-description" className="mt-1 max-w-sm text-sm leading-relaxed text-ink-muted">Play a short chime in this browser when a new notification arrives.</p>
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Notification sound"
        aria-describedby="sound-description"
        onClick={() => {
          const next = !enabled;
          setEnabled(next);
          setNotificationSoundEnabled(next);
        }}
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-transparent transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary motion-reduce:transition-none ${enabled ? "bg-brand-primary" : "bg-slate-300"}`}
      >
        <span className={`size-6 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${enabled ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
    <div className="flex items-center gap-2 border-t border-line bg-surface-page/50 px-5 py-3 text-xs text-ink-muted sm:px-6">
      <span className={`size-1.5 rounded-full ${enabled ? "bg-brand-primary" : "bg-slate-400"}`} aria-hidden />
      {enabled ? "On · This browser only" : "Off · New notifications stay quiet"}
    </div>
  </section>;
}
