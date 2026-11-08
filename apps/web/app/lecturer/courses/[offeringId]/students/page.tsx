import { CourseRoster } from "@/components/challenges/course-challenges";

export default async function LecturerStudentsPage({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  return <CourseRoster offering={offeringId} />;
}
