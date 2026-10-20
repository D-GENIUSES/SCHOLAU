"use client";
import { useEffect, useState } from "react";
import { startAppUpdates } from "@/lib/app-updates.mjs";

export function AppUpdates({ currentVersion }: { currentVersion: string }) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    return startAppUpdates({ currentVersion, onPending: setPending });
  }, [currentVersion]);
  return pending ? <aside role="status" className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border border-line bg-white p-3 text-sm text-ink shadow-card">An update is ready. It will apply after you leave this activity or reopen the app.</aside> : null;
}
