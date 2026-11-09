import Link from "next/link";
import { ClipboardList, FileText, Swords, Users } from "lucide-react";

const chip = "inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line bg-surface-page px-2.5 text-xs font-semibold text-ink hover:bg-surface-tint focus-visible:outline-2 focus-visible:outline-brand-primary sm:text-sm";

export function CourseQuickActions({ offeringId }: { offeringId: string }) {
  const base = `/lecturer/courses/${offeringId}`;
  return (
    <nav aria-label="Course shortcuts" className="mt-3 flex flex-wrap gap-2">
      <Link href={`${base}/quizzes`} className={chip}><ClipboardList className="size-3.5" aria-hidden /> Quizzes</Link>
      <Link href={`${base}/challenges`} className={chip}><Swords className="size-3.5" aria-hidden /> Challenges</Link>
      <Link href={`${base}/students`} className={chip}><Users className="size-3.5" aria-hidden /> Students</Link>
      <Link href={`${base}/content`} className={chip}><FileText className="size-3.5" aria-hidden /> Content</Link>
    </nav>
  );
}
