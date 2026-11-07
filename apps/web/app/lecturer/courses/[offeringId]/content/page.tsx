import Link from "next/link";
import { redirect } from "next/navigation";
import { CourseContentWorkspace } from "@/components/materials/course-content-workspace";
import { requireSession } from "@/lib/session";

export default async function LecturerCourseContentPage({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  const session = await requireSession(`/lecturer/courses/${offeringId}/content`);
  if (session.kind !== "ok") redirect("/lecturer");
  if (!session.profile.roles.includes("lecturer") && !session.profile.roles.includes("admin")) {
    redirect("/lecturer/application");
  }
  return (
    <CourseContentWorkspace
      offeringId={offeringId}
      backHref="/lecturer"
      backLabel="Back to lecturer home"
    />
  );
}
