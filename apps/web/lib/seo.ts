export const SITE_URL = "https://scholau.com";

export const publicPages = [
  { path: "/home", view: "home", title: "ScholAu", description: "Study university courses, practise with instant feedback, and compete in quiz battles. Explore free ScholAu sample lessons and practice questions." },
  { path: "/home?view=study", view: "study", title: "Free sample lessons in science, maths and geography", description: "Explore ScholAu's free introductory lessons in science, mathematics and geography. Start learning without an account." },
  { path: "/home?view=lesson", view: "lesson", title: "General knowledge: planets, shapes and oceans", description: "Learn why Mars is red, what makes a triangle, and which ocean is largest. Read three short free lessons, then practise with feedback." },
  { path: "/home?view=practice", view: "practice", title: "Free general knowledge practice test", description: "Test your science, maths and geography knowledge with free practice questions and instant explanations on ScholAu. No account needed." },
] as const;
