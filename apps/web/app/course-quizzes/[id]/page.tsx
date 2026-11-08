import { QuizRoom } from "@/components/lecturer-quizzes/quiz-room";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizRoom id={id} />;
}
