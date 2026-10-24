"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { readPushDevice } from "@/lib/push-browser";

export function NotificationSound() {
  const queries = useQueryClient();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
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
      try { if (localStorage.getItem("scholau.notification-sound") === "off") return; } catch { return; }
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    navigator.serviceWorker.addEventListener("message", receive);
    return () => {
      audio.pause();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      navigator.serviceWorker.removeEventListener("message", receive);
    };
  }, [queries]);
  return null;
}
