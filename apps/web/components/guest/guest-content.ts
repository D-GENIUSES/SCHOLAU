/** Public, self-contained introductory content. Never submitted as enrolled course data or XP. */
export const sampleCourses = [
  { title: "Cybersecurity Fundamentals", code: "INTRODUCTION", description: "Stay safer in the digital world.", icon: "shield" },
  { title: "Data Structures & Algorithms", code: "EXPLORE", description: "Learn how to organize and solve problems.", icon: "code" },
  { title: "Web Development", code: "EXPLORE", description: "Discover the building blocks of the web.", icon: "web" },
] as const;
export const starterLesson = {
  kind: "next" as const, lesson_id: "guest-cybersecurity", lesson_version_id: "guest-v1", title: "Spotting a phishing message",
  estimated_minutes: 3, course_id: "guest-cybersecurity", course_title: "Cybersecurity Fundamentals", offering_id: "guest-preview",
};
export const practiceQuestions = [
  { prompt: "An email says your account will close in 10 minutes and asks you to sign in through an unfamiliar link. What should you do?", options: ["Use the link immediately", "Open the service’s official website yourself", "Reply with your password"], correct: 1, explanation: "Urgency and unfamiliar links are common phishing signals. Go to the official website or app directly to check the message." },
  { prompt: "Which choice helps protect an account even if its password is stolen?", options: ["Using the same password everywhere", "Sharing a password only with friends", "Turning on multi-factor authentication"], correct: 2, explanation: "Multi-factor authentication adds another verification step. A stolen password alone may not be enough to sign in." },
  { prompt: "What should you do with a suspicious attachment from someone you don’t know?", options: ["Avoid opening it and report the message", "Open it to find out who sent it", "Forward it to everyone"], correct: 0, explanation: "Unexpected attachments can contain malicious software. Avoid opening them and use the service’s reporting option." },
] as const;
