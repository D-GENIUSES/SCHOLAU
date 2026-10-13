"use client";
import { useHomeSummary } from "@scholau/api/react";
import { HomeDashboard } from "./home-dashboard";
import { ErrorState, LoadingState } from "@/components/ui/states";
export function HomeView() {
  const home = useHomeSummary();
  if (home.isPending) return <LoadingState label="Getting your learning space ready…" lines={4} />;
  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;
  return <HomeDashboard summary={home.data} />;
}
