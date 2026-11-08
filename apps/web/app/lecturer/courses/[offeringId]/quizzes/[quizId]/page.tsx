import { QuizRoom } from "@/components/lecturer-quizzes/quiz-room";

export default async function Page({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  return <QuizRoom id={quizId} />;
}
