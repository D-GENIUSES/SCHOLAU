import type { CourseChallenge } from "./course-challenges";
import type { LecturerQuiz } from "./lecturer-quizzes";

export interface ClassroomCourse {
  code: string;
  title: string;
  semester: string;
  period: string;
}

export interface Classroom {
  id: string;
  offering_id: string;
  title: string;
  offering_ids: string[];
  programmes: string[];
  join_open: boolean;
  archived_at: string | null;
  member_count: number;
  course: ClassroomCourse;
  created_at: string;
}
export type ClassroomSummary = Classroom;

export interface ClassroomListItem {
  classroom: Classroom;
  teacher: boolean;
  member: boolean;
}

export interface ClassroomList {
  items: ClassroomListItem[];
}

export interface ClassroomInvite {
  classroom: Classroom;
  is_member: boolean;
  is_eligible: boolean;
  can_join: boolean;
}

export interface ClassroomDetail {
  classroom: Classroom;
  teacher: boolean;
  quizzes: LecturerQuiz[];
  challenges: CourseChallenge[];
}

export interface ClassroomMember {
  user_id: string;
  name: string;
  department: string;
  joined_at: string;
}

export interface ClassroomMembers {
  items: ClassroomMember[];
  total: number;
}
