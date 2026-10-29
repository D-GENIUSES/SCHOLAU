"use client";

import { useQuery } from "@tanstack/react-query";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { SEMESTER_LABELS, type SignUpInput } from "@scholau/core";
import { z } from "zod";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AcademicSelect, type AcademicOption } from "@/components/onboarding/academic-select";

const named = z.object({ id: z.string().uuid(), name: z.string() });
const labelled = z.object({ id: z.string().uuid(), label: z.string() });
const catalogueSchema = z.object({
  university_id: z.string().uuid(), faculties: z.array(named),
  departments: z.array(named.extend({ faculty_id: z.string().uuid() })), levels: z.array(labelled),
  academic_periods: z.array(labelled), semesters: z.array(labelled.extend({ academic_period_id: z.string().uuid() })),
});

const namedOptions = (items: { id: string; name: string }[]): AcademicOption[] =>
  items.map((item) => ({ value: item.name, label: item.name }));

export function RegistrationStudyFields({ form }: { form: UseFormReturn<SignUpInput> }) {
  const [universitySlug, facultyName, selected] = useWatch({ control: form.control, name: ["universitySlug", "faculty", "catalogProfile"] });
  const options = useQuery({
    queryKey: ["registration-catalogue", universitySlug], enabled: Boolean(universitySlug), staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await getBrowserSupabase().rpc("get_registration_options_v1", { p_university_slug: universitySlug });
      if (error) throw error;
      return data ? catalogueSchema.parse(data) : null;
    }, retry: false,
  });
  const data = options.data;
  const facultyId = data?.faculties.find(item => item.name === facultyName)?.id;
  const departments = data?.departments.filter(item => item.faculty_id === facultyId) ?? [];
  const semesters = data?.semesters.filter(item => item.academic_period_id === selected?.academicPeriodId) ?? [];
  const errors = form.formState.errors;
  const clearDepartment = () => {
    form.setValue("department", "");
    form.setValue("catalogProfile", undefined);
    form.setValue("currentSemester", "" as SignUpInput["currentSemester"]);
  };

  if (options.isError) return <Alert tone="error" role="alert">Your study options could not be loaded. <Button type="button" variant="link" onClick={() => void options.refetch()}>Try again</Button></Alert>;
  return <>
    {data ? <>
      <Controller control={form.control} name="faculty" render={({ field }) => (
        <AcademicSelect
          id="sign-up-faculty"
          label="Faculty"
          noun="faculties"
          filterable={false}
          error={errors.faculty?.message}
          options={namedOptions(data.faculties)}
          loading={options.isPending}
          value={field.value}
          onBlur={field.onBlur}
          selectRef={field.ref}
          onChange={(value) => {
            if (value !== field.value) clearDepartment();
            field.onChange(value);
          }}
        />
      )} />
      {!facultyId ? <Field id="sign-up-department" label="Department" hint="Choose a faculty first" error={errors.department?.message}>
        <NativeSelect disabled value=""><option value="">Choose a faculty first</option></NativeSelect>
      </Field> : <Controller control={form.control} name="department" render={({ field }) => (
        <AcademicSelect
          id="sign-up-department"
          label="Department"
          noun="departments"
          filterable={false}
          error={errors.department?.message}
          options={namedOptions(departments)}
          loading={options.isPending}
          value={field.value}
          onBlur={field.onBlur}
          selectRef={field.ref}
          onChange={(value) => {
            field.onChange(value);
            const department = departments.find(item => item.name === value);
            form.setValue("catalogProfile", department && facultyId ? {
              universityId: data.university_id, facultyId, departmentId: department.id,
              levelId: "", academicPeriodId: data.academic_periods.length === 1 ? data.academic_periods[0]?.id ?? "" : "", semesterId: "",
            } : undefined);
            form.setValue("currentSemester", "" as SignUpInput["currentSemester"]);
          }}
        />
      )} />}
    </> : <>
      <Field id="sign-up-faculty" label="Faculty" error={errors.faculty?.message}>
        <Input disabled={!universitySlug || options.isPending} autoComplete="off" placeholder="Enter your faculty" maxLength={200} {...form.register("faculty")} />
      </Field>
      <Field id="sign-up-department" label="Department" error={errors.department?.message}>
        <Input disabled={!facultyName || options.isPending} autoComplete="off" placeholder="Enter your department" maxLength={200} {...form.register("department")} />
      </Field>
    </>}
    {selected && data ? <>
      <Field id="sign-up-level" label="Level" error={errors.catalogProfile?.levelId?.message}>
        <NativeSelect {...form.register("catalogProfile.levelId")}><option value="">Select your level</option>{data.levels.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</NativeSelect>
      </Field>
      <Field id="sign-up-period" label="Academic period" error={errors.catalogProfile?.academicPeriodId?.message}>
        <NativeSelect {...form.register("catalogProfile.academicPeriodId", { onChange: () => { form.setValue("catalogProfile.semesterId", ""); form.setValue("currentSemester", "" as SignUpInput["currentSemester"]); } })}>
          <option value="">Select your academic period</option>{data.academic_periods.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </NativeSelect>
      </Field>
      <Field id="sign-up-semester" label="Current semester" error={errors.catalogProfile?.semesterId?.message ?? errors.currentSemester?.message}>
        <Controller control={form.control} name="catalogProfile.semesterId" render={({ field }) => <NativeSelect {...field} id="sign-up-semester" aria-invalid={Boolean(errors.catalogProfile?.semesterId ?? errors.currentSemester)} aria-describedby={errors.catalogProfile?.semesterId ?? errors.currentSemester ? "sign-up-semester-error" : undefined} disabled={!selected.academicPeriodId} onChange={event => {
          field.onChange(event);
          const semester = semesters.find(item => item.id === event.target.value);
          const value = Object.entries(SEMESTER_LABELS).find(([, label]) => label.toLowerCase() === semester?.label.toLowerCase())?.[0];
          form.setValue("currentSemester", (value ?? "") as SignUpInput["currentSemester"]);
        }}><option value="">Select your semester</option>{semesters.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</NativeSelect>} />
      </Field>
      <p className="text-xs text-ink-muted">These details will be saved to your profile. You won’t need to enter them again.</p>
    </> : <Field id="sign-up-semester" label="Current semester" error={errors.currentSemester?.message}>
      <NativeSelect defaultValue="" {...form.register("currentSemester")}><option value="" disabled>Select your semester</option>{Object.entries(SEMESTER_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>
    </Field>}
  </>;
}
