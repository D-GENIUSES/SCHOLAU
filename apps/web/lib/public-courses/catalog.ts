import raw from "./catalog.json";

export type PublicBlock = { type: string; text?: string; title?: string; tone?: string; level?: number; items?: string[] };
export type PublicQuestion = {
  logical_question_key: string;
  prompt: string;
  explanation: string;
  course_code: string;
  source_reference: string;
  answer_format: "standard" | "fill_in_gap";
  options?: { label: string; body: string }[];
  correct_option?: string;
  gaps?: { accepted_answers: string[] }[];
  editorial_status?: "corrected" | "flagged" | null;
  usage: string[];
};
export type PublicLesson = {
  slug: string;
  title: string;
  objective: string;
  source: string;
  editorial_status?: "corrected" | "flagged" | null;
  blocks: PublicBlock[];
};
export type PublicTopic = {
  slug: string;
  title: string;
  description: string;
  featured?: boolean;
  lessons: PublicLesson[];
  questions: PublicQuestion[];
};
export type PublicCourse = {
  slug: string;
  code: string;
  title: string;
  description: string;
  topics: PublicTopic[];
};

export const publicCatalog = raw as { courses: PublicCourse[] };

export function publicCourse(slug: string) {
  return publicCatalog.courses.find((course) => course.slug === slug) ?? null;
}

export function publicTopic(courseSlug: string, topicSlug: string) {
  const course = publicCourse(courseSlug);
  const topic = course?.topics.find((item) => item.slug === topicSlug) ?? null;
  return course && topic ? { course, topic } : null;
}

export function publicLesson(courseSlug: string, topicSlug: string, lessonSlug: string) {
  const found = publicTopic(courseSlug, topicSlug);
  const lesson = found?.topic.lessons.find((item) => item.slug === lessonSlug) ?? null;
  return found && lesson ? { ...found, lesson } : null;
}

export function topicChecks(topic: PublicTopic) {
  const mcq = topic.questions.filter((question) => question.answer_format === "standard" && question.options && question.correct_option);
  const take = Math.min(4, Math.floor(mcq.length / 2));
  return { pre: mcq.slice(0, take), post: mcq.slice(take, take * 2) };
}

export function publicCoursePaths() {
  const paths: { path: string; title: string; description: string }[] = [
    { path: "/courses", title: "Adeleke University course samples", description: "Free STA and BIO 101 lessons and practice questions on ScholAu." },
  ];
  for (const course of publicCatalog.courses) {
    paths.push({ path: `/courses/${course.slug}`, title: `${course.code} ${course.title}`, description: course.description });
    for (const topic of course.topics) {
      paths.push({
        path: `/courses/${course.slug}/${topic.slug}`,
        title: `${course.code} ${topic.title}`,
        description: topic.description,
      });
      for (const lesson of topic.lessons) {
        paths.push({
          path: `/courses/${course.slug}/${topic.slug}/${lesson.slug}`,
          title: `${course.code}: ${lesson.title}`,
          description: lesson.objective,
        });
      }
    }
  }
  return paths;
}
