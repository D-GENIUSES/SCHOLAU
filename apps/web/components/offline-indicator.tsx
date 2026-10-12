"use client";

import { WifiOff } from "lucide-react";
import { COPY } from "@scholau/core";
import { useOnline } from "@/lib/hooks";

export function OfflineIndicator() {
  const online = useOnline();
  return (
    <div role="status" aria-live="polite">
      {online ? null : (
        <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-warning px-4 py-2 text-sm font-semibold text-ink-inverse">
          <WifiOff className="size-4" aria-hidden />
          {COPY.empty.offline}
        </div>
      )}
    </div>
  );
}
