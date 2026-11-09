"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createScholauApi, isApiError } from "@scholau/api";
import { ScholauApiProvider } from "@scholau/api/react";
import { StreakCelebrationHost } from "@/components/lesson/streak-celebration-host";
import { installFeedbackSoundUnlock } from "@/lib/feedback-sounds";
import { InstallPromptProvider } from "@/components/shell/install-prompt-provider";
import { AnalyticsProvider } from "@/lib/analytics";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AuthReturnTiming } from "@/components/auth/auth-return-timing";

const BackgroundServices = dynamic(() => import("@/components/shell/background-services"), { ssr: false });

export function Providers({ children, appVersion }: { children: ReactNode; appVersion: string }) {
  const router = useRouter();
  const [backgroundReady, setBackgroundReady] = useState(false);
  useEffect(() => {
    // Keep work such as presence and version polling behind the first render.
    const timeout = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idle = window.requestIdleCallback(() => setBackgroundReady(true), { timeout: 1500 });
      } else {
        setBackgroundReady(true);
      }
    }, 1200);
    let idle: number | undefined;
    return () => {
      window.clearTimeout(timeout);
      if (idle !== undefined) window.cancelIdleCallback(idle);
    };
  }, []);
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
    installFeedbackSoundUnlock();
  }, []);

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
        <InstallPromptProvider><AnalyticsProvider><AuthReturnTiming /><StreakCelebrationHost />{children}{backgroundReady ? <BackgroundServices appVersion={appVersion} /> : null}</AnalyticsProvider></InstallPromptProvider>
      </ScholauApiProvider>
    </QueryClientProvider>
  );
}
