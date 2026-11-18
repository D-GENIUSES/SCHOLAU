import { ClassroomView } from "@/components/classrooms/classroom-view";

export default async function LecturerClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClassroomView id={id} />;
}
