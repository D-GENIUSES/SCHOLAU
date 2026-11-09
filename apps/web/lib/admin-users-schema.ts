import { z } from "zod";
import { displayNameSchema, emailSchema, passwordSchema } from "@scholau/core";

export const adminUserSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema.transform(value => value.toLowerCase()),
  password: passwordSchema,
  role: z.enum(["student", "lecturer"]),
  requestKey: z.string().uuid(),
  offeringIds: z.array(z.string().uuid()).max(100).optional().default([]),
}).strict().superRefine((data, ctx) => {
  if (data.offeringIds.length > 0 && data.role !== "lecturer") {
    ctx.addIssue({ code: "custom", message: "Only lecturer accounts can receive teaching assignments.", path: ["offeringIds"] });
  }
});
export type AdminUserInput = z.input<typeof adminUserSchema>;
