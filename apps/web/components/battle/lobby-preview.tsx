"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FriendAction, FriendPerson, ScholauApi } from "@scholau/api";
import { ScholauApiProvider } from "@scholau/api/react";
import { ShellFrame } from "@/components/shell/shell-frame";
import { BattleOpponentFriend } from "./opponent-friend";
import BattlesPage from "@/app/(student)/battles/page";

/** Development-only fixture. No invitations or matches are sent to real accounts. */
export function BattleLobbyPreview({ showFriendActions = false }: { showFriendActions?: boolean }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [api] = useState(() => {
    const stamp = new Date().toISOString();
    const courses = [
      { offering_id: "physics", course_id: "physics", code: "PHY 101", title: "General Physics I", available_questions: 60, lessons_total: 12, lessons_completed: 3 },
      { offering_id: "maths", course_id: "maths", code: "MTH 101", title: "Elementary Mathematics", available_questions: 40, lessons_total: 10, lessons_completed: 2 },
      { offering_id: "computing", course_id: "computing", code: "COS 101", title: "Introduction to Computing", available_questions: 45, lessons_total: 16, lessons_completed: 5 },
    ];
    const people: FriendPerson[] = [
      { user_id: "amara", display_name: "Amara Okafor", username: "amara", state: null, incoming: false },
      { user_id: "david", display_name: "David Chukwuemeka Nwankwo", username: "david_cyber_123456789012", state: "pending", incoming: true },
      { user_id: "ada", display_name: "Ada Obi", username: "ada", state: "accepted", incoming: false },
    ];
    const previewOnly = async () => { throw new Error("This preview does not send real challenges or enter matchmaking."); };
    return {
      getHomeSummary: async () => ({ server_time: stamp, enrolled_courses: courses }),
      getMyLiveBattle: async () => null,
      getBattleSetup: async () => ({ server_time: stamp, courses }),
      getBattleInvitations: async () => ({ server_time: stamp, invitations: [] }),
      getFriends: async () => ({ server_time: stamp, username: "learner", people: people.filter(person => person.state !== null) }),
      searchFriends: async (query: string) => ({ server_time: stamp, people: people.filter(person => `${person.username} ${person.display_name}`.toLowerCase().includes(query.toLowerCase())) }),
      getMyBattles: async () => ({ server_time: stamp, items: [], next_before: null }),
      createDirectBattle: previewOnly,
      joinQueue: previewOnly,
      friendAction: async ({ userId, action }: { userId: string; action: FriendAction }) => {
        const person = people.find(person => person.user_id === userId);
        if (!person || !["request", "accept"].includes(action)) throw new Error("Unsupported preview action");
        person.state = action === "accept" ? "accepted" : "pending";
        person.incoming = false;
        return { server_time: stamp, username: "learner", people: people.filter(person => person.state !== null).map(person => ({ ...person })) };
      },
    } as unknown as ScholauApi;
  });
  return <QueryClientProvider client={client}><ScholauApiProvider api={api}><ShellFrame pathname="/battles" displayName="Learner">
    <p className="mb-4 text-xs text-ink-muted">Design preview · sample data · no real invitations or matches.</p>{showFriendActions ? <div className="flex flex-col gap-4">{[{ id: "amara", name: "Amara Okafor" }, { id: "david", name: "David Chukwuemeka Nwankwo" }, { id: "ada", name: "Ada Obi" }].map(person => <BattleOpponentFriend key={person.id} opponent={{ user_id: person.id, display_name: person.name, avatar_path: null, seat: 2, is_me: false, ready: true, forfeited: false, correct_count: 3 }} />)}</div> : <BattlesPage />}
  </ShellFrame></ScholauApiProvider></QueryClientProvider>;
}
