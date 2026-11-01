"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FriendAction, FriendPerson, ScholauApi } from "@scholau/api";
import { ScholauApiProvider } from "@scholau/api/react";
import { ShellFrame } from "@/components/shell/shell-frame";
import { PublicProfileView } from "./public-profile-view";

/** Development-only fixture: friend actions remain in memory. */
export function PublicProfilePreview() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [api] = useState(() => {
    const stamp = new Date().toISOString();
    let people: FriendPerson[] = [];
    return {
      getPublicProfile: async () => ({ server_time: stamp, id: "sample-learner", display_name: "Amara Okafor", username: "amara", avatar_path: null, joined_at: "2026-09-10T12:00:00Z", university: "Adeleke University", faculty: "Science", department: "Computer Science", level: "200 Level", xp_total: 1240, badges: ["first_steps", "perfect_practice", "topic_mastered"] }),
      searchFriends: async (query: string) => ({ server_time: stamp, people: "amara okafor".includes(query.toLowerCase()) ? [{ user_id: "sample-learner", display_name: "Amara Okafor", username: "amara", avatar_path: null, state: null, incoming: false }] : [] }),
      getMyProfile: async () => ({ server_time: stamp, id: "sample-viewer" }),
      getFriends: async () => ({ server_time: stamp, username: "learner", people: [...people] }),
      friendAction: async ({ userId, action }: { userId: string; action: FriendAction }) => {
        people = action === "request" ? [{ user_id: userId, display_name: "Amara Okafor", username: "amara", state: "pending", incoming: false }] : [];
        return { server_time: stamp, username: "learner", people: [...people] };
      },
    } as unknown as ScholauApi;
  });
  return <QueryClientProvider client={client}><ScholauApiProvider api={api}><ShellFrame pathname="/people" displayName="Learner">
    <p className="mx-auto mb-4 max-w-3xl text-xs text-ink-muted">Design preview · sample profile · friend actions stay in this browser.</p>
    <PublicProfileView userId="sample-learner" />
  </ShellFrame></ScholauApiProvider></QueryClientProvider>;
}
