"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { readPushDevice } from "@/lib/push-browser";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function NotificationSound() {
  const queries = useQueryClient();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const syncUnreadBadge = async () => {
      const unread = queries.getQueryData<{ unread_notifications?: number }>(["scholau", "home"])?.unread_notifications ?? 0;
      try {
        if (unread > 0 && "setAppBadge" in navigator) await navigator.setAppBadge(unread);
        else if ("clearAppBadge" in navigator) await navigator.clearAppBadge();
      } catch { /* The browser may not support home-screen badges. */ }
    };
    const homeQueryUpdated = (event: { query?: { queryKey?: readonly unknown[] } }) => {
      if (event.query?.queryKey?.[0] === "scholau" && event.query.queryKey[1] === "home") void syncUnreadBadge();
    };
    const unsubscribe = queries.getQueryCache().subscribe(homeQueryUpdated);
    void syncUnreadBadge();
    const client = getBrowserSupabase();
    let active = true;
    let channel: ReturnType<typeof client.channel> | null = null;
    void client.auth.getSession().then(({ data }) => {
      if (!active || !data.session?.user.id) return;
      channel = client.channel(`notification-count:${data.session.user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${data.session.user.id}` }, () => {
          void queries.invalidateQueries({ queryKey: ["scholau", "home"] });
        }).subscribe();
    });
    const refreshOnFocus = () => { if (document.visibilityState === "visible") void queries.invalidateQueries({ queryKey: ["scholau", "home"] }); };
    document.addEventListener("visibilitychange", refreshOnFocus);
    const audio = new Audio("/sounds/scholau-notification.wav");
    audio.volume = 0.35;
    // A user gesture unlocks media on browsers that require it. No audible sound.
    const unlock = () => {
      audio.muted = true;
      void audio.play().then(() => { audio.pause(); audio.currentTime = 0; audio.muted = false; }).catch(() => { audio.muted = false; });
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== navigator.serviceWorker.controller || event.data?.type !== "scholau-notification") return;
      if (document.visibilityState !== "visible" || readPushDevice()?.key !== event.data.deviceKey) return;
      void queries.invalidateQueries({ queryKey: ["scholau", "notifications"] });
      void queries.invalidateQueries({ queryKey: ["scholau", "home"] });
      if ("clearAppBadge" in navigator) void navigator.clearAppBadge().catch(() => undefined);
      try { if (localStorage.getItem("scholau.notification-sound") === "off") return; } catch { return; }
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    navigator.serviceWorker.addEventListener("message", receive);
    return () => {
      audio.pause();
      active = false;
      if (channel) void client.removeChannel(channel);
      unsubscribe();
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      navigator.serviceWorker.removeEventListener("message", receive);
    };
  }, [queries]);
  return null;
}
