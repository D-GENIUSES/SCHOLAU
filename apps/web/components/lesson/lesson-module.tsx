"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";
import type { CourseModule } from "@scholau/api";
import { Card } from "@/components/ui/card";
import { LessonStateBadge } from "@/components/lesson/lesson-state-badge";

export function ModuleSection({ module, startAt }: { module: CourseModule; startAt: number }) {
  const [expanded, setExpanded] = useState(false);
  const done = module.lessons.filter((l) => l.state === "completed").length;
  const visibleLessons = expanded ? module.lessons : module.lessons.slice(0, 6);
  const listId = `lessons-${module.id}`;
  return (
    <Card className="lesson-module">
      <div className="lesson-module-heading">
        <h3>{module.title}</h3>
        <span>{done}/{module.lessons.length} completed</span>
      </div>
        <ol id={listId} start={startAt + 1} className="lesson-compact-list">
          {visibleLessons.map((l, index) => (
            <li key={l.lesson_id}>
              <Link href={`/study/lessons/${l.lesson_id}`} className="lesson-compact-row" data-state={l.state}>
                <span className="lesson-number" aria-hidden>{String(startAt + index + 1).padStart(2, "0")}</span>
                <div className="lesson-row-body">
                  <span className="lesson-row-title"><span className="sr-only">Lesson {startAt + index + 1}: </span>{l.title}</span>
                  <div className="lesson-row-meta">
                    <span className="lesson-duration"><Clock className="size-3" aria-hidden /> {l.estimated_minutes} min</span>
                    <LessonStateBadge state={l.state} />
                  </div>
                </div>
                <ChevronRight className="lesson-row-arrow size-4" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      {module.lessons.length > 6 ? <button type="button" className="lesson-list-toggle" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>
        {expanded ? "Show fewer lessons" : `Show all ${module.lessons.length} lessons`}
        <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
      </button> : null}
    </Card>
  );
}

