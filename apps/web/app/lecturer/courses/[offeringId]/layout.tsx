import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CourseNavigation } from "@/components/lecturer/course-navigation";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { lecturerApi } from "@/lib/lecturer-api";
import { requireSession } from "@/lib/session";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function LecturerCourseLayout({ params, children }: {
  params: Promise<{ offeringId: string }>;
  children: ReactNode;
}) {
  const { offeringId } = await params;
  const session = await requireSession(`/lecturer/courses/${offeringId}/content`);
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;

  const lecturer = session.profile.roles.includes("lecturer");
  const admin = session.profile.roles.includes("admin");
  if (!lecturer) {
    if (admin) return children;
    redirect("/lecturer/application");
  }

  let courses;
  try {
    courses = await lecturerApi(await getServerSupabase()).courses();
  } catch {
    if (admin) return children;
    return <ServiceUnavailable reference="SA-LECTURER-COURSES" message="Your course workspace could not be loaded. Please try again." />;
  }
  const course = courses.items.find(({ id }) => id === offeringId);
  if (!course) {
    if (admin) return children;
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <Link href="/lecturer" className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-control text-sm font-semibold text-ink-muted hover:text-brand-primary focus-visible:outline-2 focus-visible:outline-brand-primary">
          <ArrowLeft className="size-4" aria-hidden /> My courses
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm font-semibold text-brand-primary">{course.code}</p>
          <Link href={`/lecturer/announcements?course=${course.id}`} className="rounded-control text-sm font-semibold text-brand-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand-primary">
            Announce to this class
          </Link>
        </div>
        <p className="mt-1 wrap-break-word text-2xl font-bold tracking-tight sm:text-3xl">{course.title}</p>
        <p className="mb-4 mt-1 text-sm text-ink-muted"><span className="font-semibold text-ink">Class</span> · {course.department} · {course.period} · {course.semester}</p>
        <CourseNavigation offeringId={offeringId} />
      </header>
      {children}
    </div>
  );
}
