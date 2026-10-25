"use client";
import { useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function UserPresence() {
  useEffect(() => {
    const client = getBrowserSupabase();
    let active = true;
    let userId: string | null = null;
    let lastSent = 0;
    let inFlight = false;
    const heartbeat = () => {
      if (!active || !userId || inFlight || document.visibilityState !== "visible" || !navigator.onLine || Date.now() - lastSent < 20000) return;
      lastSent = Date.now();
      inFlight = true;
      void Promise.resolve(client.rpc("user_heartbeat_v1")).then(() => {}, () => {}).finally(() => { inFlight = false; });
    };
    const sessionChanged = (id: string | null) => {
      if (!active) return;
      if (id !== userId) lastSent = 0;
      userId = id;
      queueMicrotask(heartbeat);
    };
    void client.auth.getSession().then(({ data }) => sessionChanged(data.session?.user.id ?? null));
    const { data } = client.auth.onAuthStateChange((_event, session) => sessionChanged(session?.user.id ?? null));
    const timer = window.setInterval(heartbeat, 30000);
    document.addEventListener("visibilitychange", heartbeat);
    window.addEventListener("online", heartbeat);
    window.addEventListener("focus", heartbeat);
    return () => {
      active = false;
      window.clearInterval(timer);
      data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", heartbeat);
      window.removeEventListener("online", heartbeat);
      window.removeEventListener("focus", heartbeat);
    };
  }, []);
  return null;
}
