"use client";

import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import type { LecturerOffering } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function CreateQuizAction({ courses }: { courses: Pick<LecturerOffering, "id" | "code" | "title" | "department" | "period" | "semester">[] }) {
  const [first, second] = courses;
  if (!first) return null;
  if (!second) {
    return <Button asChild className="sm:shrink-0"><Link href={`/lecturer/courses/${first.id}/quizzes/new`}><Plus className="size-4" aria-hidden /> Create quiz</Link></Button>;
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="sm:shrink-0"><Plus className="size-4" aria-hidden /> Create quiz</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Create quiz</DialogTitle>
        <DialogDescription>Choose the course for this quiz.</DialogDescription>
        <ul className="divide-y divide-line rounded-control border border-line">
          {courses.map((course) => (
            <li key={course.id}>
              <DialogClose asChild>
                <Link href={`/lecturer/courses/${course.id}/quizzes/new`} className="flex min-h-11 items-center gap-3 px-3 py-3 hover:bg-surface-tint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary">
                  <span className="min-w-0 flex-1 wrap-break-word">
                    <span className="block text-sm font-semibold">{course.code} · {course.title}</span>
                    <span className="block text-xs text-ink-muted">{course.department} · {course.period} · {course.semester}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
                </Link>
              </DialogClose>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
