import { CourseContentWorkspace } from "@/components/materials/course-content-workspace";

export default async function LecturerCourseContentPage({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  return <CourseContentWorkspace offeringId={offeringId} />;
}
