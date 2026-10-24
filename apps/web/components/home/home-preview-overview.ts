import type { CourseOverview } from "@scholau/api";

type PreviewCourse = { offering_id: string; course_id: string; code: string; title: string; lessons_total: number; lessons_completed: number };

/** Sample course map for `/design-preview` (no live RPC). */
export function buildPreviewCourseOverview(course: PreviewCourse): CourseOverview {
  const offeringId = course.offering_id;
  const lessons = [
    { title: "Discovering the world around us", minutes: 5, state: "completed" as const },
    { title: "How we measure and compare", minutes: 6, state: "completed" as const },
    { title: "Patterns in everyday life", minutes: 5, state: "started" as const },
    { title: "Thinking with evidence", minutes: 7, state: "not_started" as const },
  ];
  return {
    server_time: new Date().toISOString(),
    offering_id: offeringId,
    course: {
      id: course.course_id,
      code: course.code,
      title: course.title,
      description: "Development preview sample map.",
    },
    progress: {
      lessons_total: course.lessons_total,
      lessons_completed: course.lessons_completed,
      percent: course.lessons_total > 0 ? Math.round((100 * course.lessons_completed) / course.lessons_total) : 0,
    },
    unit_count: 3,
    requirement_status: "C",
    battle_ready: true,
    assessments: [{ assessment_id: "a1", assessment_version_id: "av1", kind: "practice", title: "Quick check", lesson_id: null, question_count: 10, duration_seconds: null, feedback_mode: "after_submit", active_attempt_id: null, completed_attempts: 0, best_percent: null, first_completion_rewarded: false }],
    modules: [
      {
        id: "preview-mod-1",
        title: "Foundations",
        position: 1,
        lessons: lessons.map((item, index) => ({
          lesson_id: index === 2 ? "preview-lesson" : `preview-lesson-${index}`,
          lesson_version_id: `preview-version-${index}`,
          position: index + 1,
          title: item.title,
          objective: item.title,
          estimated_minutes: item.minutes,
          state: item.state,
          completed_at: item.state === "completed" ? new Date().toISOString() : null,
        })),
      },
      {
        id: "preview-mod-2",
        title: "Applied reasoning",
        position: 2,
        lessons: [
          { lesson_id: "preview-lesson-4", lesson_version_id: "preview-version-4", position: 1, title: "Connecting ideas across topics", objective: "", estimated_minutes: 6, state: "not_started", completed_at: null },
          { lesson_id: "preview-lesson-5", lesson_version_id: "preview-version-5", position: 2, title: "Review and reflection", objective: "", estimated_minutes: 5, state: "not_started", completed_at: null },
        ],
      },
    ],
  };
}
