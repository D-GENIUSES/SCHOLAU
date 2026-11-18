import { notFound } from "next/navigation";
import { ChallengeEditor } from "@/components/challenges/challenge-editor";
import { classroomApi } from "@/lib/classroom-api";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function NewClassroomChallengePage({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params;
  let room;
  try {
    room = await classroomApi(await getServerSupabase()).detail(classroomId);
  } catch {
    notFound();
  }
  if (!room.teacher || room.classroom.archived_at) notFound();
  return <ChallengeEditor offering={room.classroom.offering_id} classroomId={classroomId} />;
}
