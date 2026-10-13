/** Public, self-contained introductory content. Never submitted as enrolled course data or XP. */
export const sampleCourses = [
  { title: "Science and Nature", code: "EXPLORE", description: "Discover the world around us.", icon: "shield" },
  { title: "Everyday Numbers", code: "EXPLORE", description: "Explore patterns, shapes, and simple ideas.", icon: "code" },
  { title: "Our World", code: "EXPLORE", description: "Get curious about places and the planet.", icon: "web" },
] as const;
export const starterLesson = {
  kind: "next" as const, lesson_id: "guest-general-knowledge", lesson_version_id: "guest-v2", title: "Explore science, numbers, and the world around us.",
  estimated_minutes: 3, course_id: "guest-general-knowledge", course_title: "General Knowledge", offering_id: "guest-preview",
};
export const practiceQuestions = [
  { prompt: "Which planet is known as the Red Planet?", options: ["Jupiter", "Mars", "Venus"], correct: 1, explanation: "Mars is known as the Red Planet because iron oxide on its surface gives it a reddish appearance." },
  { prompt: "How many sides does a triangle have?", options: ["Three", "Four", "Five"], correct: 0, explanation: "A triangle has three straight sides and three corners, regardless of its size or orientation." },
  { prompt: "Which is the largest ocean on Earth?", options: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean"], correct: 2, explanation: "The Pacific Ocean is the largest ocean on Earth. Oceans are vast bodies of salt water." },
] as const;
