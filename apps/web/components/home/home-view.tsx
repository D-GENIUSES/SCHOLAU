"use client";
import { useHomeSummary } from "@scholau/api/react";
import { HomePrompts } from "./home-prompts";
import { HomeDashboard } from "./home-dashboard";
import { ErrorState, LoadingState } from "@/components/ui/states";
export function HomeView({ owner }: { owner: string }) {
  const home = useHomeSummary();
  if (home.isPending) return <LoadingState variant="home" label="Getting your learning space ready…" lines={4} />;
  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;
  return <><HomePrompts key={owner} owner={owner} /><HomeDashboard summary={home.data} /></>;
}
