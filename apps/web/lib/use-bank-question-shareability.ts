"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchShareability(versionIds: string[]) {
  const response = await fetch(`/api/shared-questions?versions=${encodeURIComponent(versionIds.join(","))}`, { credentials: "same-origin" });
  if (!response.ok) throw new Error("shareability");
  const body = await response.json() as { versions: Record<string, boolean> };
  return body.versions;
}

export function useBankQuestionShareability(versionIds: string[]) {
  const key = versionIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["shared-questions", key],
    queryFn: () => fetchShareability(versionIds),
    enabled: versionIds.length > 0,
    staleTime: 60_000,
  });
}
