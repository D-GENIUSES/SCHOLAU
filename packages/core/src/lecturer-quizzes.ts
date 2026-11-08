export type LecturerQuizState = "draft" | "upcoming" | "open" | "closed" | "cancelled";

export interface LecturerQuiz {
  id: string;
  offering_id: string;
  title: string;
  instructions: string;
  duration_minutes: number;
  state: LecturerQuizState;
  opens_at: string | null;
  closes_at: string | null;
  revision: number;
  question_count: number;
  max_attempts: number;
  feedback_mode: "after_submit" | "immediate";
}

export interface LecturerQuizQuestion {
  prompt: string;
  options: string[];
  correct?: number;
  explanation?: string;
}

export interface LecturerQuizDraft {
  title: string;
  instructions: string;
  duration_minutes: number;
  opens_at?: string | null;
  closes_at?: string | null;
  max_attempts?: number;
  feedback_mode?: "after_submit" | "immediate";
  questions: LecturerQuizQuestion[];
}

export interface LecturerQuizAttempt {
  id: string;
  attempt_number: number;
  answers: Record<string, number>;
  question_order?: number[];
  option_orders?: number[][];
  revision: number;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  score: number | null;
}

export interface LecturerQuizProfileHint {
  display_name: string;
  department: string | null;
  matric_number: string | null;
}

export interface LecturerQuizDetail {
  quiz: LecturerQuiz;
  teacher: boolean;
  questions: LecturerQuizQuestion[];
  attempts_used: number;
  profile: LecturerQuizProfileHint | null;
  identity: { matric_number: string; display_name: string; department: string } | null;
  attempt: LecturerQuizAttempt | null;
  server_time: string;
}

export interface LecturerQuizList {
  items: LecturerQuiz[];
  teacher: boolean;
  course: { code: string; title: string; semester: string; period: string };
}

export interface LecturerQuizRosterRow {
  user_id: string;
  name: string;
  matric_number: string | null;
  department: string | null;
  attempt_number: number | null;
  score: number | null;
  submitted_at: string | null;
  status: "not_started" | "in_progress" | "submitted";
}

export interface LecturerQuizRoster {
  items: LecturerQuizRosterRow[];
  total: number;
  quiz: LecturerQuiz;
}

export interface LecturerQuizExportRow {
  matric_number: string;
  name: string;
  department: string;
  attempt_number: number;
  score: number | null;
  total: number;
  submitted_at: string | null;
  answers: Record<string, number>;
}

export interface LecturerQuizExport {
  quiz: LecturerQuiz;
  questions: LecturerQuizQuestion[];
  rows: LecturerQuizExportRow[];
}

export interface LecturerQuizImportJob {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  proposed_questions: LecturerQuizQuestion[] | null;
  error_message: string | null;
}
