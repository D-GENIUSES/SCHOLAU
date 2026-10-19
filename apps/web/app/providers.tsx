"use client";

import { useRouter } from "next/navigation";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { createScholauApi, isApiError } from "@scholau/api";
import { ScholauApiProvider } from "@scholau/api/react";
import { NotificationLive } from "@/components/notifications/notification-live";
import { PushLifecycle } from "@/components/notifications/push-lifecycle";
import { AnalyticsProvider } from "@/lib/analytics";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [api] = useState(() => createScholauApi(getBrowserSupabase()));
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            // Session expired mid-use: send the user back to sign in, preserving where they were.
            if (isApiError(error, "UNAUTHENTICATED") && typeof window !== "undefined") {
              const next = encodeURIComponent(window.location.pathname + window.location.search);
              router.replace(`/sign-in?next=${next}`);
            }
          },
        }),
        defaultOptions: {
          queries: { staleTime: 60_000, gcTime: 10 * 60_000 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ScholauApiProvider api={api}>
        <AnalyticsProvider><PushLifecycle /><NotificationLive />{children}</AnalyticsProvider>
      </ScholauApiProvider>
    </QueryClientProvider>
  );
}
