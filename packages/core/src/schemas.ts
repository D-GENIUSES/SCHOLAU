import { z } from "zod";
import { NIGERIAN_UNIVERSITIES } from "./nigerian-universities";

/** Input schemas for forms. They mirror server validation for UX only; the server re-validates. */

export const emailSchema = z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use 72 characters or fewer.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(60, "Use 60 characters or fewer.")
  .refine((v) => !v.includes("@"), "Use your name or a nickname, not your email address.")
  .refine((v) => !/[<>]/.test(v), "Remove the < and > characters.");

export const usernameSchema = z.string().trim().toLowerCase()
  .regex(/^[a-z][a-z0-9_]{2,23}$/, "Use 3–24 characters: letters, numbers and underscores, starting with a letter.");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});
export type SignInInput = z.infer<typeof signInSchema>;

const universitySlugs = new Set<string>(NIGERIAN_UNIVERSITIES.map((university) => university.value));
const academicName = (label: string) => z.string().trim().min(2, `Enter your ${label}.`).max(200, "Use 200 characters or fewer.")
  .refine((value) => !/[<>]/.test(value), "Remove the < and > characters.");

/** Self-reported signup details. Course enrollment still uses validated catalog IDs. */
export const registrationAcademicSchema = z.object({
  universitySlug: z.string().refine((value) => universitySlugs.has(value), "Choose a university from the list."),
  faculty: academicName("faculty"),
  department: academicName("department"),
  currentSemester: z.enum(["first", "second", "third"], { message: "Choose your current semester." }),
});
export type RegistrationAcademicInput = z.infer<typeof registrationAcademicSchema>;

export const signUpSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
}).extend(registrationAcademicSchema.shape);
export type SignUpInput = z.infer<typeof signUpSchema>;

export const recoverSchema = z.object({ email: emailSchema });
export type RecoverInput = z.infer<typeof recoverSchema>;

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match.", path: ["confirm"] });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

const requiredId = (label: string) => z.string().uuid(`Choose your ${label}.`);

export const academicProfileSchema = z.object({
  universityId: requiredId("university"),
  facultyId: requiredId("faculty"),
  departmentId: requiredId("department"),
  levelId: requiredId("level"),
  academicPeriodId: requiredId("academic period"),
  semesterId: requiredId("semester"),
});
export type AcademicProfileInput = z.infer<typeof academicProfileSchema>;

/** Order matters: changing a field resets every descendant. */
export const ACADEMIC_FIELD_ORDER = [
  "universityId",
  "facultyId",
  "departmentId",
  "levelId",
  "academicPeriodId",
  "semesterId",
] as const satisfies readonly (keyof AcademicProfileInput)[];

export function academicDescendants(field: keyof AcademicProfileInput): (keyof AcademicProfileInput)[] {
  // Level and period depend on university only; department depends on faculty; semester on period.
  switch (field) {
    case "universityId":
      return ["facultyId", "departmentId", "levelId", "academicPeriodId", "semesterId"];
    case "facultyId":
      return ["departmentId"];
    case "academicPeriodId":
      return ["semesterId"];
    default:
      return [];
  }
}

export const updateProfileSchema = z.object({
  username: usernameSchema,
  leaderboardVisible: z.boolean(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const reportSchema = z.object({
  category: z.enum(["incorrect", "unclear", "typo", "offensive", "broken", "other"], {
    message: "Choose what's wrong.",
  }),
  note: z.string().trim().min(1, "Tell us what you noticed.").max(2000, "Use 2000 characters or fewer."),
});
export type ReportInput = z.infer<typeof reportSchema>;

export const reasonSchema = z.string().trim().min(3, "Give a reason (at least 3 characters).").max(1000);

export const grantPremiumSchema = z.object({
  userId: z.string().uuid("Enter a valid user ID."),
  endsAt: z.string().min(1, "Choose an end date."),
  reason: reasonSchema,
});
export type GrantPremiumInput = z.infer<typeof grantPremiumSchema>;

export const triageReportSchema = z.object({
  state: z.enum(["triaged", "resolved", "dismissed"]),
  resolution: z.string().trim().max(2000).optional(),
});
export type TriageReportInput = z.infer<typeof triageReportSchema>;
