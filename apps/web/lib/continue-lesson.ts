import type { CourseModule } from "@scholau/api";

function lessonsInOrder(modules: CourseModule[]) {
  return modules.flatMap((module) => [...module.lessons].sort((a, b) => a.position - b.position));
}

/** First in-progress lesson, else first not started in curriculum order. */
export function resolveContinueLessonId(modules: CourseModule[]): string | null {
  const lessons = lessonsInOrder(modules);
  const started = lessons.find((lesson) => lesson.state === "started");
  if (started) return started.lesson_id;
  const next = lessons.find((lesson) => lesson.state === "not_started");
  return next?.lesson_id ?? null;
}

export function resolveContinueLesson(modules: CourseModule[]) {
  const id = resolveContinueLessonId(modules);
  if (!id) return null;
  const lesson = lessonsInOrder(modules).find((item) => item.lesson_id === id);
  return lesson ? { lesson_id: lesson.lesson_id, title: lesson.title, state: lesson.state } : null;
}

/** First lesson in the course when nothing is in progress or left to start. */
export function resolveFirstLessonId(modules: CourseModule[]): string | null {
  const lessons = lessonsInOrder(modules);
  return lessons[0]?.lesson_id ?? null;
}
