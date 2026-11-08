import { QuizEditor } from "@/components/lecturer-quizzes/quiz-editor";

export default async function Page({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  return <QuizEditor offering={offeringId} />;
}
