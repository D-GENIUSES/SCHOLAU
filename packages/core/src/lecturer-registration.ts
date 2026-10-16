import { z } from "zod";
import { emailSchema, passwordSchema } from "./schemas";

const text = (max: number) => z.string().trim().min(2, "Use at least 2 characters.").max(max);
export const lecturerApplicationSchema = z.object({
  full_name: text(120), university: text(200), faculty: text(200), department: text(200),
  position: text(120), requested_courses: text(2000),
  institutional_profile_url: z.string().trim().max(500).refine(v => !v || /^https:\/\/[^\s]+$/.test(v), "Use an https:// profile URL."),
  verification_note: z.string().trim().max(2000),
});
export const lecturerSignUpSchema = lecturerApplicationSchema.extend({ email: emailSchema, password: passwordSchema });
export type LecturerApplicationInput = z.infer<typeof lecturerApplicationSchema>;
export type LecturerSignUpInput = z.infer<typeof lecturerSignUpSchema>;
export type LecturerApplicationStatus = "pending" | "changes_requested" | "approved" | "rejected";
export interface LecturerApplication extends LecturerApplicationInput {
  id: string; user_id: string; email: string; email_verified: boolean;
  status: LecturerApplicationStatus; revision: number; applicant_message: string;
  created_at: string; updated_at: string; reviewed_at: string | null;
  institutional_profile_url: string;
  assigned_offering_ids: string[];
  history: { action: string; applicant_message: string; created_at: string; internal_note?: string; actor_id?: string | null }[];
}
export interface LecturerOffering {
  id: string; code: string; title: string; university: string; department: string; semester: string; period: string;
}
