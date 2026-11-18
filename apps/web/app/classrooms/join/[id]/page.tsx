import { ClassroomInvite } from "@/components/classrooms/classroom-view";
import { ClassroomStudentShell } from "@/components/classrooms/classroom-student-shell";

export default async function ClassroomInvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClassroomStudentShell nextPath={`/classrooms/join/${id}`}><ClassroomInvite id={id} /></ClassroomStudentShell>;
}
