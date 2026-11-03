"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { readPushDevice } from "@/lib/push-browser";
import { installNotificationSoundUnlock, playNotificationChime } from "@/lib/notification-sound";

export function NotificationSound() {
  const queries = useQueryClient();
  useEffect(() => {
    installNotificationSoundUnlock();
    if (!("serviceWorker" in navigator)) return;
    const receive = (event: MessageEvent) => {
      if (event.source !== navigator.serviceWorker.controller || event.data?.type !== "scholau-notification") return;
      if (document.visibilityState !== "visible" || readPushDevice()?.key !== event.data.deviceKey) return;
      void queries.invalidateQueries({ queryKey: ["scholau", "notifications"] });
      void queries.invalidateQueries({ queryKey: ["scholau", "home"] });
      playNotificationChime();
    };
    navigator.serviceWorker.addEventListener("message", receive);
    return () => {
      navigator.serviceWorker.removeEventListener("message", receive);
    };
  }, [queries]);
  return null;
}
