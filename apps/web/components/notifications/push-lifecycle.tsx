"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { disableBrowserPush, enrollPendingNotifications, postponePushPermission, readPushDevice, readPushPermissionReminder, requestSignupNotifications } from "@/lib/push-browser";

/** Finish email-confirmed consent and offer a reminder 24 hours after refusal. */
export function PushLifecycle() {
  const [reminderOwner, setReminderOwner] = useState<string | null>(null);
  useEffect(() => {
    let owner: string | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const client = getBrowserSupabase();
    const retry = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const currentOwner = owner;
        void (async () => {
          const device = readPushDevice();
          if (device && device.owner !== currentOwner) await disableBrowserPush(false);
          if (cancelled || !currentOwner || currentOwner !== owner) return;
          await enrollPendingNotifications(currentOwner).catch(() => undefined);
          if (cancelled || currentOwner !== owner) return;
          if (readPushDevice()?.owner === currentOwner && "Notification" in window && Notification.permission === "granted") {
            setReminderOwner(null); return;
          }
          let reminder = readPushPermissionReminder(currentOwner);
          if (!reminder && "Notification" in window && Notification.permission === "denied") {
            postponePushPermission(currentOwner);
            reminder = readPushPermissionReminder(currentOwner);
          }
          if (!reminder || reminder.nextAskAt > Date.now()) return;
          if (!("Notification" in window) || !("PushManager" in window)) return;
          const { data, error } = await client.rpc("get_notification_preferences_v1");
          if (!cancelled && currentOwner === owner && !error && data?.push_available) {
            // Persist the next offer so refreshes and other tabs do not nag.
            postponePushPermission(currentOwner);
            setReminderOwner(currentOwner);
          }
        })().catch(() => undefined);
      }, 0);
    };
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const nextOwner = session?.user.id ?? null;
      if (nextOwner !== owner) setReminderOwner(null);
      owner = nextOwner;
      retry();
    });
    const interval = setInterval(retry, 60000);
    window.addEventListener("focus", retry);
    window.addEventListener("scholau-push-consent", retry);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("focus", retry);
      window.removeEventListener("scholau-push-consent", retry);
      data.subscription.unsubscribe();
    };
  }, []);
  if (!reminderOwner) return null;
  return <PermissionReminder key={reminderOwner} owner={reminderOwner} onClose={() => setReminderOwner(null)} />;
}

function PermissionReminder({ owner, onClose }: { owner: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function enable() {
    setBusy(true); setMessage("");
    try {
      if (await requestSignupNotifications(owner)) {
        await enrollPendingNotifications(owner);
        onClose();
      } else {
        setMessage("Open this site’s browser settings, change Notifications from Block to Allow, then return and tap Enable notifications.");
      }
    } catch { setMessage("Notifications could not be enabled. You can try again later."); }
    finally { setBusy(false); }
  }
  return <aside role="region" aria-label="Notification permission reminder" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-card border border-line bg-surface-card p-5 shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6">
    <h2 className="text-lg font-bold">Allow notifications?</h2>
    <p className="my-3 text-sm text-ink-muted">Stay up to date with ScholAu. You can enable notifications now or we will remind you tomorrow.</p>
    <div className="flex flex-wrap gap-3">
      <Button loading={busy} onClick={() => void enable()}>Enable notifications</Button>
      <Button variant="ghost" disabled={busy} onClick={() => { postponePushPermission(owner); onClose(); }}>Later</Button>
    </div>
    {message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}
  </aside>;
}
