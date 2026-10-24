"use client";

import { useNotifications, useScholauApi, useUserSignals } from "@scholau/api/react";
import { useEffect, useRef, useState } from "react";
import { installNotificationSoundUnlock, playNotificationChime } from "@/lib/notification-sound";

/**
 * One user-topic subscription for every signed-in screen, plus a chime when the
 * inbox gains an id after the first snapshot for this account.
 */
export function NotificationLive() {
  const api = useScholauApi();
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    void api.supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setUserId(data.session?.user.id);
    });
    const { data } = api.supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUserId(session?.user.id);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [api]);

  useUserSignals(userId);
  useNotificationChime(userId);
  return null;
}

function useNotificationChime(userId: string | undefined) {
  const notifications = useNotifications(Boolean(userId));
  const seen = useRef<Set<string> | null>(null);
  const baselineAfter = useRef(0);

  useEffect(() => {
    installNotificationSoundUnlock();
  }, []);

  useEffect(() => {
    seen.current = null;
    baselineAfter.current = Date.now();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const items = notifications.data;
    if (!items || notifications.dataUpdatedAt < baselineAfter.current) return;
    const ids = items.map((item) => item.id);
    const known = seen.current;
    if (known === null) {
      seen.current = new Set(ids);
      return;
    }
    const hasNew = ids.some((id) => !known.has(id));
    for (const id of ids) known.add(id);
    if (hasNew) playNotificationChime();
  }, [userId, notifications.data, notifications.dataUpdatedAt]);
}
