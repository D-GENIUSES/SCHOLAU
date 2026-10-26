"use client";

import { useRouter } from "next/navigation";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createScholauApi, isApiError } from "@scholau/api";
import { ScholauApiProvider } from "@scholau/api/react";
import { UserPresence } from "@/components/shell/user-presence";
import { AppUpdates } from "@/components/shell/app-updates";
import { NotificationSound } from "@/components/notifications/notification-sound";
import { InstallPromptProvider } from "@/components/shell/install-prompt-provider";
import { PushLifecycle } from "@/components/notifications/push-lifecycle";
import { AnalyticsProvider } from "@/lib/analytics";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function Providers({ children, appVersion }: { children: ReactNode; appVersion: string }) {
  const router = useRouter();
  const [api] = useState(() => createScholauApi(getBrowserSupabase()));
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (isApiError(error, "INVALID_STATE") && error.field_errors?.registration_required === true) {
              router.replace("/complete-registration");
              return;
            }
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
  const owner = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    // Query keys are shared across accounts. Never show the previous account's
    // cached profile, notifications or assessments after a session changes.
    const { data } = getBrowserSupabase().auth.onAuthStateChange((_event, session) => {
      const nextOwner = session?.user.id ?? null;
      if (owner.current !== undefined && owner.current !== nextOwner) queryClient.clear();
      owner.current = nextOwner;
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ScholauApiProvider api={api}>
        <InstallPromptProvider><AnalyticsProvider><UserPresence /><AppUpdates currentVersion={appVersion} /><NotificationSound /><PushLifecycle />{children}</AnalyticsProvider></InstallPromptProvider>
      </ScholauApiProvider>
    </QueryClientProvider>
  );
}
