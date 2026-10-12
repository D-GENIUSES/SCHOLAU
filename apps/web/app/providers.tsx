"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { createScholauApi, isApiError } from "@scholau/api";
import { ScholauApiProvider } from "@scholau/api/react";
import { AnalyticsProvider } from "@/lib/analytics";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function Providers({ children }: { children: ReactNode }) {
  const [api] = useState(() => createScholauApi(getBrowserSupabase()));
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            // Session expired mid-use: send the user back to sign in, preserving where they were.
            if (isApiError(error, "UNAUTHENTICATED") && typeof window !== "undefined") {
              const next = encodeURIComponent(window.location.pathname + window.location.search);
              window.location.href = `/sign-in?next=${next}`;
            }
          },
        }),
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: true },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ScholauApiProvider api={api}>
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </ScholauApiProvider>
    </QueryClientProvider>
  );
}
