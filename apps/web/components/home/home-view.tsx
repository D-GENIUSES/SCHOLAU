"use client";
import { useHomeSummary } from "@scholau/api/react";
import { HomeDashboard } from "./home-dashboard";
import { HomeSkeleton } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/states";
export function HomeView() {
  const home = useHomeSummary();
  if (home.isPending) return <HomeSkeleton />;
  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;
  return <HomeDashboard summary={home.data} />;
}
