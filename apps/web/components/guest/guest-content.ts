import type { LeaderboardRow } from "@scholau/api";

export const guestCourses = [
  { id: "1", title: "Course 1" },
  { id: "2", title: "Course 2" },
  { id: "3", title: "Course 3" },
] as const;

export const guestRanking: LeaderboardRow[] = [
  { rank: 1, user_id: "guest-1", display_name: "Ada M.", xp_total: 1280 },
  { rank: 2, user_id: "guest-2", display_name: "Tobi A.", xp_total: 1050 },
  { rank: 3, user_id: "guest-3", display_name: "Sam K.", xp_total: 940 },
  { rank: 4, user_id: "guest-4", display_name: "Nora E.", xp_total: 820 },
  { rank: 5, user_id: "guest-5", display_name: "Mika O.", xp_total: 710 },
].map((row) => ({ ...row, is_me: false, avatar_path: null }));
