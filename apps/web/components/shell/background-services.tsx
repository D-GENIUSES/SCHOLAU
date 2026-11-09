"use client";

import { UserPresence } from "@/components/shell/user-presence";
import { AppUpdates } from "@/components/shell/app-updates";
import { NotificationSound } from "@/components/notifications/notification-sound";
import { PushLifecycle } from "@/components/notifications/push-lifecycle";

export default function BackgroundServices({ appVersion }: { appVersion: string }) {
  return (
    <>
      <UserPresence />
      <AppUpdates currentVersion={appVersion} />
      <NotificationSound />
      <PushLifecycle />
    </>
  );
}
