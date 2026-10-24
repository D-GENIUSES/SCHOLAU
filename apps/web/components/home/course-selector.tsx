"use client";

import { ChevronDown, List } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { HomeSummary } from "@scholau/api";
import { pluralize } from "@scholau/core";
import { Progress } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

type Course = HomeSummary["enrolled_courses"][number];

export function CourseSelector({
  courses,
  selectedId,
  open,
  onOpenChange,
  onSelect,
}: {
  courses: Course[];
  selectedId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (offeringId: string) => void;
}) {
  const selected = courses.find((c) => c.offering_id === selectedId) ?? courses[0];
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (!selected) return null;

  return (
    <div className="course-selector" ref={rootRef}>
      <button
        type="button"
        className="course-selector-trigger"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="listbox"
        onClick={() => onOpenChange(!open)}
      >
        <List className="size-4 shrink-0 opacity-70" aria-hidden />
        <span className="course-selector-label">
          <span className="course-selector-code">{selected.code}</span>
          <span className="course-selector-title">{selected.title}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 opacity-60 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <ul id={menuId} role="listbox" aria-label="Your courses" className="course-selector-menu">
          {courses.map((course) => {
            const percent = course.lessons_total > 0 ? Math.round((100 * course.lessons_completed) / course.lessons_total) : 0;
            const active = course.offering_id === selectedId;
            return (
              <li key={course.offering_id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className="course-selector-option"
                  data-active={active}
                  onClick={() => {
                    onSelect(course.offering_id);
                    onOpenChange(false);
                  }}
                >
                  <span className="min-w-0 flex-1 text-left">
                    <span className="course-selector-option-code">{course.code}</span>
                    <span className="course-selector-option-title">{course.title}</span>
                    <span className="course-selector-option-meta">
                      {course.lessons_completed} of {pluralize(course.lessons_total, "lesson")}
                    </span>
                  </span>
                  <span className="course-selector-option-progress" aria-hidden>
                    <Progress value={percent} label={`${course.code} progress`} className="h-1 w-14" tone={percent >= 100 ? "success" : "brand"} />
                    <span className="text-[10px] font-semibold tabular-nums text-ink-muted">{percent}%</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
