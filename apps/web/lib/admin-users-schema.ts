import { z } from "zod";
import { displayNameSchema, emailSchema, passwordSchema } from "@scholau/core";

export const adminUserSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema.transform(value => value.toLowerCase()),
  password: passwordSchema,
  role: z.enum(["student", "lecturer"]),
  requestKey: z.string().uuid(),
}).strict();
export type AdminUserInput = z.input<typeof adminUserSchema>;
