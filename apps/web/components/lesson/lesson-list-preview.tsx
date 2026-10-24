import type { CourseModule } from "@scholau/api";
import { ModuleSection } from "./lesson-module";
import { PageHeader } from "@/components/ui/misc";

const titles = [
  "Programming and the Java platform", "Programming paradigms and structured control",
  "Variables, types, constants and identifiers", "Expressions, operators and assignment",
  "Keyboard input and console output", "Selection and loops", "Arrays and array processing",
  "Strings and string processing", "Methods and pass-by-value", "Classes, objects and encapsulation",
  "Constructors", "Inheritance", "Runtime polymorphism", "Searching algorithms", "Sorting algorithms",
  "Programming errors and debugging",
];
const previewModule: CourseModule = {
  id: "preview-programming", title: "Understand the essentials", position: 1,
  lessons: titles.map((title, index) => ({
    lesson_id: `preview-${index}`, lesson_version_id: `version-${index}`, position: index + 1,
    title, objective: `Explain and apply ${title.toLowerCase()}.`, estimated_minutes: index % 3 + 5,
    state: index < 2 ? "completed" : index === 2 ? "started" : "not_started", completed_at: null,
  })),
};

export function LessonListPreview() {
  return <>
    <PageHeader eyebrow="COS 201" title="Computer Programming I" description="Development preview · sample lesson progress" />
    <section aria-labelledby="preview-lessons" className="flex flex-col gap-3">
      <h2 id="preview-lessons" className="text-lg font-bold">Lessons <span className="ml-1 text-sm font-normal text-ink-muted">16 lessons</span></h2>
      <ModuleSection module={previewModule} startAt={0} />
    </section>
  </>;
}
