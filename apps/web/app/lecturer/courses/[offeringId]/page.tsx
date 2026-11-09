import { redirect } from "next/navigation";

export default async function LecturerCourseIndexPage({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  redirect(`/lecturer/courses/${offeringId}/content`);
}
