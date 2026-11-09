"use client";
import type { HomeSummary } from "@scholau/api";
import { useHomeSummary } from "@scholau/api/react";
import { HomePrompts } from "./home-prompts";
import { HomeDashboard } from "./home-dashboard";
import { ErrorState, LoadingState } from "@/components/ui/states";
export function HomeView({ owner, initialHome }: { owner: string; initialHome?: HomeSummary }) {
  const home = useHomeSummary(initialHome);
  if (home.isPending) return <LoadingState variant="home" label="Loading home…" lines={4} />;
  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;
  return <><HomePrompts key={owner} owner={owner} /><HomeDashboard summary={home.data} /></>;
}
