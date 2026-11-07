import type { HomeSummary, LeaderboardRow } from "@scholau/api";

function sampleCourse(id: string): HomeSummary["enrolled_courses"][number] {
  return {
    offering_id: id,
    course_id: id,
    code: id,
    title: `Course ${id}`,
    lessons_total: 3,
    lessons_completed: 0,
  };
}

export const guestCourses = [sampleCourse("1"), sampleCourse("2"), sampleCourse("3")] satisfies [
  HomeSummary["enrolled_courses"][number],
  ...HomeSummary["enrolled_courses"],
];

export const guestRanking: LeaderboardRow[] = [
  { rank: 1, user_id: "guest-1", display_name: "Ada M.", xp_total: 1280 },
  { rank: 2, user_id: "guest-2", display_name: "Tobi A.", xp_total: 1050 },
  { rank: 3, user_id: "guest-3", display_name: "Sam K.", xp_total: 940 },
  { rank: 4, user_id: "guest-4", display_name: "Nora E.", xp_total: 820 },
  { rank: 5, user_id: "guest-5", display_name: "Mika O.", xp_total: 710 },
].map((row) => ({ ...row, is_me: false, avatar_path: null }));
