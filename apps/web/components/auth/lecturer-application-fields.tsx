"use client";
import type { UseFormRegisterReturn } from "react-hook-form";
import type { LecturerApplicationInput } from "@scholau/core";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";

export function LecturerApplicationFields({ register, errors }: { register: (name: keyof LecturerApplicationInput) => UseFormRegisterReturn; errors: Partial<Record<keyof LecturerApplicationInput, { message?: string }>> }) {
  return <div className="lecturer-fields">
    {([
      ["full_name", "Full name", 120], ["university", "University", 200], ["faculty", "Faculty", 200],
      ["department", "Department", 200], ["position", "Teaching position", 120],
    ] as const).map(([name, label, max]) => <Field key={name} id={`lecturer-${name}`} className={name === "full_name" ? "lecturer-field-wide" : undefined} label={label} error={errors[name]?.message}>
      <Input autoComplete={name === "full_name" ? "name" : "off"} maxLength={max} {...register(name)} />
    </Field>)}
    <Field className="lecturer-field-wide" id="lecturer-requested-courses" label="Courses you teach or wish to manage" hint="Include course codes and titles. An administrator confirms assignments." error={errors.requested_courses?.message}>
      <Textarea maxLength={2000} {...register("requested_courses")} />
    </Field>
    <Field className="lecturer-field-wide" id="lecturer-profile-url" label="Institutional profile URL (optional)" hint="An https:// link to your university staff page, if available." error={errors.institutional_profile_url?.message}>
      <Input type="url" maxLength={500} {...register("institutional_profile_url")} />
    </Field>
    <Field className="lecturer-field-wide" id="lecturer-verification-note" label="Additional verification information (optional)" hint="Help us verify your teaching affiliation. Do not include identity documents or other sensitive records." error={errors.verification_note?.message}>
      <Textarea maxLength={2000} {...register("verification_note")} />
    </Field>
  </div>;
}
