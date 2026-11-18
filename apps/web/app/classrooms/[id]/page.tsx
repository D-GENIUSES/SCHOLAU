import { ClassroomView } from "@/components/classrooms/classroom-view";
import { ClassroomStudentShell } from "@/components/classrooms/classroom-student-shell";

export default async function StudentClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClassroomStudentShell nextPath={`/classrooms/${id}`}><ClassroomView id={id} /></ClassroomStudentShell>;
}
