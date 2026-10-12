"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { isApiError, type Profile } from "@scholau/api";
import { useOnboardingOptions, useSetAcademicProfile } from "@scholau/api/react";
import {
  type AcademicProfileInput,
  academicDescendants,
  academicProfileSchema,
  COPY,
  fieldErrorMessage,
} from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState, InlineError } from "@/components/ui/states";
import { useAnalytics } from "@/lib/analytics";
import { type AcademicOption, AcademicSelect } from "./academic-select";
import { ChangeLimitNotice } from "./change-limit-notice";

type FieldName = keyof AcademicProfileInput;

const API_FIELDS: Record<string, FieldName> = {
  university_id: "universityId",
  faculty_id: "facultyId",
  department_id: "departmentId",
  level_id: "levelId",
  academic_period_id: "academicPeriodId",
  semester_id: "semesterId",
};

function initialValues(profile: Profile): AcademicProfileInput {
  const a = profile.academic;
  return {
    universityId: a?.university.id ?? "",
    facultyId: a?.faculty.id ?? "",
    departmentId: a?.department.id ?? "",
    levelId: a?.level.id ?? "",
    academicPeriodId: a?.academic_period.id ?? "",
    semesterId: a?.semester.id ?? "",
  };
}

const named = (items: { id: string; name: string }[] | undefined): AcademicOption[] =>
  (items ?? []).map((i) => ({ value: i.id, label: i.name }));
const labelled = (items: { id: string; label: string }[] | undefined): AcademicOption[] =>
  (items ?? []).map((i) => ({ value: i.id, label: i.label }));

export function AcademicProfileForm({
  profile,
  changeMode,
  onCompleted,
}: {
  profile: Profile;
  changeMode: boolean;
  onCompleted: () => void;
}) {
  const analytics = useAnalytics();
  const setAcademic = useSetAcademicProfile();
  const [pending, setPending] = useState<AcademicProfileInput | null>(null);
  const form = useForm<AcademicProfileInput>({ resolver: zodResolver(academicProfileSchema), defaultValues: initialValues(profile) });
  const { control, formState } = form;
  const errors = formState.errors;
  const [universityId, facultyId, academicPeriodId] = useWatch({ control, name: ["universityId", "facultyId", "academicPeriodId"] });
  const options = useOnboardingOptions(universityId || null, facultyId || null, academicPeriodId || null);
  const data = options.data;
  const childLoading = options.isPending || options.isPlaceholderData;

  const save = (values: AcademicProfileInput) => {
    setAcademic.mutate(values, {
      onSuccess: () => {
        setPending(null);
        if (!changeMode) analytics.track({ name: "onboarding_completed" });
        onCompleted();
      },
      onError: (err) => {
        setPending(null);
        if ((err.code === "INVALID_PROFILE" || err.code === "VALIDATION_FAILED") && err.field_errors) {
          for (const [key, value] of Object.entries(err.field_errors)) {
            const field = API_FIELDS[key];
            if (field) form.setError(field, { message: fieldErrorMessage(value) });
          }
        }
      },
    });
  };

  const onSubmit = form.handleSubmit((values) => {
    setAcademic.reset();
    if (changeMode) setPending(values);
    else save(values);
  });

  const select = (
    name: FieldName,
    props: { id: string; label: string; noun: string; hint?: string; options: AcademicOption[]; loading: boolean },
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <AcademicSelect
          {...props}
          error={errors[name]?.message}
          value={field.value}
          onBlur={field.onBlur}
          selectRef={field.ref}
          onChange={(value) => {
            field.onChange(value);
            for (const d of academicDescendants(name)) form.setValue(d, "", { shouldDirty: true });
          }}
        />
      )}
    />
  );

  if (options.isError && !data) return <ErrorState error={options.error} onRetry={() => void options.refetch()} />;

  const forbidden = isApiError(setAcademic.error, "FORBIDDEN");

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {changeMode ? (
        <Alert tone="info" title="Before you change your details">
          {COPY.academicChange}
        </Alert>
      ) : null}

      {select("universityId", { id: "ob-university", label: "University", noun: "universities", options: named(data?.universities), loading: !data })}
      {universityId
        ? select("facultyId", { id: "ob-faculty", label: "Faculty", noun: "faculties", options: named(data?.faculties), loading: childLoading })
        : null}
      {facultyId
        ? select("departmentId", {
            id: "ob-department",
            label: "Department",
            noun: "departments",
            options: named(data?.departments),
            loading: childLoading,
          })
        : null}
      {universityId
        ? select("levelId", {
            id: "ob-level",
            label: "Level",
            noun: "levels",
            hint: "Your academic year, e.g. 300 Level.",
            options: labelled(data?.levels),
            loading: childLoading,
          })
        : null}
      {universityId
        ? select("academicPeriodId", {
            id: "ob-period",
            label: "Academic period",
            noun: "academic periods",
            options: labelled(data?.academic_periods),
            loading: childLoading,
          })
        : null}
      {academicPeriodId
        ? select("semesterId", { id: "ob-semester", label: "Semester", noun: "semesters", options: labelled(data?.semesters), loading: childLoading })
        : null}

      {forbidden ? <ChangeLimitNotice /> : <InlineError error={setAcademic.error} />}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {changeMode ? (
          <Button asChild variant="outline">
            <Link href="/profile">Cancel</Link>
          </Button>
        ) : null}
        <Button type="submit" loading={setAcademic.isPending && !pending}>
          {changeMode ? "Save academic details" : "Continue"}
        </Button>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !setAcademic.isPending) setPending(null);
        }}
        title="Change your academic profile?"
        description={COPY.academicChange}
        confirmLabel="Confirm change"
        loading={setAcademic.isPending}
        onConfirm={() => {
          if (pending) save(pending);
        }}
      />
    </form>
  );
}
