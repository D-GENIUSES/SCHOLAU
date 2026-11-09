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
      <header className="mb-4">
        <Link href="/lecturer" className="mb-2 inline-flex min-h-9 items-center gap-1.5 rounded-control text-xs font-semibold text-ink-muted hover:text-brand-primary focus-visible:outline-2 focus-visible:outline-brand-primary">
          <ArrowLeft className="size-3.5" aria-hidden /> Courses
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-xs font-semibold text-brand-primary">{course.code}</p>
          <h1 className="wrap-break-word text-lg font-bold tracking-tight sm:text-xl">{course.title}</h1>
        </div>
        <p className="mb-3 mt-0.5 text-xs text-ink-muted">{course.department} · {course.period} · {course.semester}</p>
        <CourseNavigation offeringId={offeringId} />
      </header>
      {children}
    </div>
  );
}
