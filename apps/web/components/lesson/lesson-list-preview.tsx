"use client";

import type { CourseOverview } from "@scholau/api";
import { useMemo } from "react";
import { CourseLearningMap } from "@/components/home/course-learning-map";
import { PageHeader } from "@/components/ui/misc";
import { resolveContinueLessonId } from "@/lib/continue-lesson";

const previewOverview: CourseOverview = {
  server_time: new Date().toISOString(),
  offering_id: "preview-cos201",
  course: {
    id: "preview-course-cos201",
    code: "COS 201",
    title: "Computer Programming I",
    description: "Development preview · sample lesson progress",
  },
  progress: { lessons_total: 16, lessons_completed: 2, percent: 13 },
  unit_count: 4,
  requirement_status: "C",
  battle_ready: false,
  assessments: [],
  modules: [
    {
      id: "preview-programming",
      title: "Understand the essentials",
      position: 1,
      lessons: [
        "Programming and the Java platform",
        "Programming paradigms and structured control",
        "Variables, types, constants and identifiers",
        "Expressions, operators and assignment",
        "Keyboard input and console output",
        "Selection and loops",
        "Arrays and array processing",
        "Strings and string processing",
      ].map((title, index) => ({
        lesson_id: `preview-${index}`,
        lesson_version_id: `version-${index}`,
        position: index + 1,
        title,
        objective: `Explain and apply ${title.toLowerCase()}.`,
        estimated_minutes: (index % 3) + 5,
        state: index < 2 ? "completed" : index === 2 ? "started" : "not_started",
        completed_at: index < 2 ? new Date().toISOString() : null,
      })),
    },
    {
      id: "preview-programming-2",
      title: "Objects and abstraction",
      position: 2,
      lessons: [
        "Methods and pass-by-value",
        "Classes, objects and encapsulation",
        "Constructors",
        "Inheritance",
        "Runtime polymorphism",
        "Searching algorithms",
        "Sorting algorithms",
        "Programming errors and debugging",
      ].map((title, index) => ({
        lesson_id: `preview-b-${index}`,
        lesson_version_id: `version-b-${index}`,
        position: index + 1,
        title,
        objective: "",
        estimated_minutes: (index % 3) + 5,
        state: "not_started",
        completed_at: null,
      })),
    },
  ],
};

export function LessonListPreview() {
  const continueLessonId = useMemo(
    () => resolveContinueLessonId(previewOverview.modules),
    [],
  );
  return (
    <>
      <PageHeader
        eyebrow={previewOverview.course.code}
        title={previewOverview.course.title}
        description={previewOverview.course.description ?? undefined}
      />
      <section aria-labelledby="preview-lessons" className="mt-4 flex flex-col gap-3">
        <h2 id="preview-lessons" className="text-lg font-bold">
          Lessons
        </h2>
        <CourseLearningMap
          overview={previewOverview}
          continueLessonId={continueLessonId}
          preview={false}
        />
      </section>
    </>
  );
}
