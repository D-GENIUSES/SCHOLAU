import { StudentClassrooms } from "@/components/classrooms/classroom-view";
import { ClassroomStudentShell } from "@/components/classrooms/classroom-student-shell";

export default function ClassroomsPage() {
  return <ClassroomStudentShell nextPath="/classrooms"><StudentClassrooms /></ClassroomStudentShell>;
}
