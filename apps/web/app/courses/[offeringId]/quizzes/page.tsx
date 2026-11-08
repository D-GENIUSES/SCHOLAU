import { CourseQuizzes } from "@/components/lecturer-quizzes/course-quizzes";

export default async function Page({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  return <CourseQuizzes offering={offeringId} />;
}
