import { notFound } from "next/navigation";
import { QuizEditor } from "@/components/lecturer-quizzes/quiz-editor";
import { classroomApi } from "@/lib/classroom-api";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function NewClassroomQuizPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params;
  let room;
  try {
    room = await classroomApi(await getServerSupabase()).detail(classroomId);
  } catch {
    notFound();
  }
  if (!room.teacher || room.classroom.archived_at) notFound();
  return <QuizEditor offering={room.classroom.offering_id} classroomId={classroomId} />;
}
