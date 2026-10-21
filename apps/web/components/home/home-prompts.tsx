"use client";

import { useEffect, useState } from "react";
import { Bell, PlusSquare, Share, Smartphone, X } from "lucide-react";
import { useNotificationSettings } from "@scholau/api/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useInstallPrompt } from "@/components/shell/install-prompt-provider";
import { enableBrowserPush, readPushDevice } from "@/lib/push-browser";

function readChoice(key: string) { try { return localStorage.getItem(key) === "done"; } catch { return false; } }
function remember(key: string) { try { localStorage.setItem(key, "done"); } catch { /* Storage restrictions must not block Home. */ } }

/** Mounted only after an authenticated, onboarded Home has loaded. */
export function HomePrompts({ owner }: { owner: string }) {
  const device = useInstallPrompt();
  const settings = useNotificationSettings();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(true);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const notificationKey = `scholau.home.notifications.v1:${owner}:${device.installed ? "app" : "browser"}`;
  const installKey = `scholau.home.install.v1:${owner}`;
  const needsIosInstall = device.ios && !device.installed;

  useEffect(() => {
    if (!device.ready) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      setInstallDismissed(readChoice(installKey));
      const supportsPush = window.isSecureContext && "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
      const denied = "Notification" in window && Notification.permission === "denied";
      const enabled = readPushDevice()?.owner === owner && "Notification" in window && Notification.permission === "granted";
      setNotificationsOpen(!readChoice(notificationKey) && !denied && !enabled && (needsIosInstall || supportsPush));
    }, 0);
    const enabled = () => { remember(notificationKey); setNotificationsOpen(false); };
    window.addEventListener("scholau-push-consent", enabled);
    return () => { active = false; window.clearTimeout(timer); window.removeEventListener("scholau-push-consent", enabled); };
  }, [device.ready, installKey, needsIosInstall, notificationKey, owner]);

  function dismissNotifications() { remember(notificationKey); setNotificationsOpen(false); }
  async function enable() {
    if (busy || !settings.data) return;
    setBusy(true); setMessage("");
    remember(notificationKey);
    try {
      // No network calls before this: Safari requires the permission request during the tap.
      await enableBrowserPush(settings.data.vapid_public_key, owner);
      setNotificationsOpen(false);
      await settings.refetch();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Notifications could not be enabled. You can try again in notification settings."); }
    finally { setBusy(false); }
  }
  async function install() {
    setMessage("");
    if (needsIosInstall) { setInstructionsOpen(true); return; }
    try { await device.install(); }
    catch { setMessage("Use your browser’s menu to install ScholAu or add it to your Home Screen."); }
  }
  const showInstall = device.ready && !device.installed && !installDismissed && (device.ios || device.available);
  return <>
    {showInstall ? <aside aria-label="Install ScholAu" className="mb-5 grid grid-cols-[44px_minmax(0,1fr)_32px] items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary text-white"><Smartphone className="size-6" aria-hidden /></span>
      <div className="min-w-0 flex-1"><h2 className="text-sm font-bold">Install ScholAu</h2><p className="mt-1 text-xs leading-relaxed text-ink-muted">Your learning app, one tap from your Home Screen.</p></div>
      <Button size="sm" className="col-start-2 row-start-2 justify-self-start" onClick={() => void install()}>{needsIosInstall ? "Add to Home Screen" : "Install"}</Button>
      <button type="button" aria-label="Dismiss install suggestion" className="col-start-3 row-start-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-brand-primary" onClick={() => { remember(installKey); setInstallDismissed(true); }}><X className="size-4" aria-hidden /></button>
      {message && !notificationsOpen ? <p role="status" className="col-span-3 text-sm">{message}</p> : null}
    </aside> : null}
    <Dialog open={notificationsOpen && Boolean(settings.data?.push_available)} onOpenChange={open => { if (!open && !busy) dismissNotifications(); }}>
      <DialogContent onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
        <span className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-brand-primary"><Bell className="size-7" aria-hidden /></span>
        <DialogTitle>Stay in the loop</DialogTitle>
        <DialogDescription>{needsIosInstall ? "Get course updates and learning reminders. First, add ScholAu to your Home Screen, then open the app to enable notifications." : "Turn on notifications for course updates and learning reminders. You can change this anytime in settings."}</DialogDescription>
        <div className="mt-2 flex flex-wrap gap-3"><Button loading={busy} onClick={() => { if (needsIosInstall) { dismissNotifications(); setInstructionsOpen(true); } else void enable(); }}>{needsIosInstall ? "Show me how" : "Enable notifications"}</Button><Button variant="ghost" disabled={busy} onClick={dismissNotifications}>Not now</Button></div>
        {message ? <p role="status" className="text-sm">{message}</p> : null}
      </DialogContent>
    </Dialog>
    <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
      <DialogContent>
        <span className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-brand-primary"><Smartphone className="size-7" aria-hidden /></span>
        <DialogTitle>Add ScholAu to your Home Screen</DialogTitle>
        <DialogDescription>Install it once, then open ScholAu just like your other apps.</DialogDescription>
        <ol className="space-y-4 text-sm leading-relaxed">
          <li className="flex gap-3"><Share className="mt-0.5 size-5 shrink-0 text-brand-primary" aria-hidden /><span>Open your browser’s <strong>Share</strong> menu. You may need to tap <strong>…</strong> first.</span></li>
          <li className="flex gap-3"><PlusSquare className="mt-0.5 size-5 shrink-0 text-brand-primary" aria-hidden /><span>Choose <strong>Add to Home Screen</strong>. Keep <strong>Open as Web App</strong> enabled if shown, then tap <strong>Add</strong>.</span></li>
          <li className="flex gap-3"><Bell className="mt-0.5 size-5 shrink-0 text-brand-primary" aria-hidden /><span>Open <strong>ScholAu</strong> from its new icon to enable notifications.</span></li>
        </ol>
        <Button onClick={() => setInstructionsOpen(false)}>Got it</Button>
      </DialogContent>
    </Dialog>
  </>;
}
