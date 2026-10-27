"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useController, useFormContext, useWatch } from "react-hook-form";
import type { LecturerApplicationInput } from "@scholau/core";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { courseRequest, lecturerCatalogueSchema, lecturerCoursesSchema, lecturerUniversities, NOT_LISTED, savedChoice } from "@/lib/lecturer-catalogue";

const otherOption = { value: NOT_LISTED, label: "Not listed" };
type AcademicName = "university" | "faculty" | "department";

function CatalogueStatus({ loading, failed, empty, retry }: { loading: boolean; failed: boolean; empty: boolean; retry: () => void }) {
  if (loading) return <p role="status" className="text-xs text-ink-muted">Loading options…</p>;
  if (failed) return <p role="alert" className="text-xs text-ink-muted">Options could not be loaded. <Button type="button" variant="link" onClick={retry}>Try again</Button> or choose “Not listed”.</p>;
  if (empty) return <p role="status" className="text-xs text-ink-muted">No catalogue options available. Choose “Not listed” to continue.</p>;
  return null;
}

/** IDs remain local to the form; applications retain their readable text contract. */
export function LecturerApplicationFields() {
  const form = useFormContext<LecturerApplicationInput>();
  const { register, control, formState: { errors } } = form;
  const [university, faculty, department] = useWatch({ control, name: ["university", "faculty", "department"] });
  const { field: courseField } = useController({ control, name: "requested_courses" });
  const [choices, setChoices] = useState<Partial<Record<AcademicName, string>>>({});
  const [selectedCourses, setSelectedCourses] = useState<SearchOption[]>([]);
  // Preserve existing requests verbatim rather than guessing which courses they mean.
  const [manualCourses, setManualCourses] = useState<string | null>(() => form.getValues("requested_courses") || null);
  const universityChoice = choices.university ?? savedChoice(lecturerUniversities, university);
  const universitySlug = universityChoice === NOT_LISTED ? "" : universityChoice;
  const catalogue = useQuery({
    queryKey: ["lecturer-registration-catalogue", universitySlug], enabled: Boolean(universitySlug), staleTime: 300_000, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await getBrowserSupabase().rpc("get_registration_options_v1", { p_university_slug: universitySlug }).abortSignal(signal);
      if (error) throw error;
      return data ? lecturerCatalogueSchema.parse(data) : null;
    },
  });
  const facultyOptions = (catalogue.data?.faculties ?? []).map(item => ({ value: item.id, label: item.name }));
  const facultyChoice = choices.faculty ?? savedChoice(facultyOptions, faculty);
  const facultyId = facultyChoice === NOT_LISTED ? "" : facultyChoice;
  const departmentOptions = (facultyId ? catalogue.data?.departments.filter(item => item.faculty_id === facultyId) ?? [] : [])
    .map(item => ({ value: item.id, label: item.name }));
  const departmentChoice = choices.department ?? savedChoice(departmentOptions, department);
  const departmentId = departmentChoice === NOT_LISTED ? "" : departmentChoice;
  const universityId = catalogue.data?.university_id;
  const canLoadCourses = Boolean(universitySlug && universityId && facultyId && departmentId);
  const courses = useQuery({
    queryKey: ["lecturer-registration-courses", universityId, facultyId, departmentId], enabled: canLoadCourses, staleTime: 300_000, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await getBrowserSupabase().rpc("get_lecturer_registration_courses_v1", {
        p_university_id: universityId, p_faculty_id: facultyId, p_department_id: departmentId,
      }).abortSignal(signal);
      if (error) throw error;
      return lecturerCoursesSchema.parse(data);
    },
  });
  const courseOptions = (canLoadCourses ? courses.data ?? [] : []).map(item => ({ value: item.id, label: `${item.code} — ${item.title}` }));
  const setText = (name: AcademicName | "requested_courses", value: string) => form.setValue(name, value, { shouldDirty: true, shouldValidate: Boolean(form.formState.isSubmitted) });
  const resetCourses = () => { setSelectedCourses([]); setManualCourses(null); setText("requested_courses", ""); };
  const clearChildren = (name: AcademicName) => {
    if (name === "university") { setText("faculty", ""); setText("department", ""); }
    if (name === "faculty") setText("department", "");
    resetCourses();
  };
  const choose = (name: AcademicName, value: string, options: readonly SearchOption[]) => {
    const previous = name === "university" ? universityChoice : name === "faculty" ? facultyChoice : departmentChoice;
    if (value === previous) return;
    setText(name, options.find(item => item.value === value)?.label ?? "");
    clearChildren(name);
    if (name === "university") {
      setChoices({ university: value, faculty: "", department: "" });
    } else if (name === "faculty") {
      setChoices(current => ({ ...current, faculty: value, department: "" }));
    } else setChoices(current => ({ ...current, department: value }));
  };
  const syncCourses = (next: SearchOption[], manual: string | null) => {
    setSelectedCourses(next); setManualCourses(manual); setText("requested_courses", courseRequest(next, manual));
  };
  const affiliation = (name: AcademicName, label: string, options: readonly SearchOption[], value: string, text: string, disabled: boolean, key: string) => <div key={name}>
    <Field id={`lecturer-${name}`} label={label} error={value === NOT_LISTED ? undefined : errors[name]?.message}>
      <SearchSelect id={`lecturer-${name}`} key={key} options={options} fallbackOption={otherOption} value={value} disabled={disabled} placeholder={`Select ${label.toLowerCase()}`}
        onBlur={() => void form.trigger(name)} ref={value === NOT_LISTED ? undefined : register(name).ref}
        onChange={next => choose(name, next, options)} />
    </Field>
    {value === NOT_LISTED ? <Field id={`lecturer-${name}-manual`} label={`${label} name`} className="mt-2" error={errors[name]?.message}>
      <Input autoComplete="off" placeholder={`Enter your ${label.toLowerCase()}`} maxLength={200} required value={text} {...register(name)}
        onChange={event => {
          setText(name, event.target.value); clearChildren(name);
          setChoices(current => name === "university" ? { university: NOT_LISTED, faculty: "", department: "" } : name === "faculty" ? { ...current, department: "" } : current);
        }} />
    </Field> : null}
  </div>;

  return <div className="lecturer-fields">
    <Field id="lecturer-full_name" label="Full name" error={errors.full_name?.message}><Input autoComplete="name" maxLength={120} {...register("full_name")} /></Field>
    <Field id="lecturer-position" label="Teaching position" error={errors.position?.message}><Input autoComplete="organization-title" maxLength={120} {...register("position")} /></Field>
    {affiliation("university", "University", lecturerUniversities, universityChoice, university, false, "university")}
    <div>
      {affiliation("faculty", "Faculty", facultyOptions, facultyChoice, faculty, !university?.trim(), universityChoice)}
      {universitySlug ? <CatalogueStatus loading={catalogue.isFetching} failed={catalogue.isError} empty={!catalogue.isPending && !facultyOptions.length} retry={() => void catalogue.refetch()} /> : null}
    </div>
    {affiliation("department", "Department", departmentOptions, departmentChoice, department, !faculty?.trim(), `${universityChoice}-${facultyChoice}`)}
    <div className="lecturer-field-wide">
      <Field id="lecturer-requested-courses" label="Courses you teach or wish to manage" hint="Select one or more courses. An administrator confirms assignments." error={errors.requested_courses?.message}>
        <SearchSelect id="lecturer-requested-courses" key={`${universityChoice}-${facultyChoice}-${departmentChoice}`} ref={node => { if (manualCourses === null) courseField.ref(node); }}
          options={courseOptions.filter(item => !selectedCourses.some(selected => selected.value === item.value))} fallbackOption={otherOption} value=""
          disabled={!department?.trim()} placeholder="Search by course code or title" onBlur={() => courseField.onBlur()}
          onChange={value => {
            if (!value) return;
            if (value === NOT_LISTED) { syncCourses(selectedCourses, manualCourses ?? ""); return; }
            const picked = courseOptions.find(item => item.value === value);
            if (picked && !selectedCourses.some(item => item.value === value)) syncCourses([...selectedCourses, picked], manualCourses);
          }} />
      </Field>
      {canLoadCourses ? <CatalogueStatus loading={courses.isFetching} failed={courses.isError} empty={!courses.isPending && !courseOptions.length} retry={() => void courses.refetch()} /> : null}
      {selectedCourses.length ? <ul aria-label="Selected courses" className="lecturer-course-chips">
        {selectedCourses.map(item => <li key={item.value}><span>{item.label}</span><button type="button" aria-label={`Remove ${item.label}`} onClick={() => syncCourses(selectedCourses.filter(selected => selected.value !== item.value), manualCourses)}>×</button></li>)}
      </ul> : null}
      {manualCourses !== null ? <div className="mt-2">
        <Field id="lecturer-courses-manual" label="Other courses" hint="Enter course codes and titles, one per line. Existing requests are kept here." error={manualCourses.trim().length < 2 ? errors.requested_courses?.message : undefined}>
          <Textarea ref={node => courseField.ref(node)} name="lecturer-courses-manual" required value={manualCourses} maxLength={2000} onBlur={() => courseField.onBlur()} onChange={event => syncCourses(selectedCourses, event.target.value)} />
        </Field>
        <Button type="button" variant="link" onClick={() => syncCourses(selectedCourses, null)}>Remove other courses</Button>
      </div> : null}
    </div>
    <details className="lecturer-field-wide lecturer-verification" open={errors.institutional_profile_url || errors.verification_note ? true : undefined}>
      <summary>Additional verification details (optional)</summary>
      <div className="mt-3 grid gap-3">
        <Field id="lecturer-profile-url" label="Institutional profile URL" hint="An https:// link to your university staff page, if available." error={errors.institutional_profile_url?.message}>
          <Input type="url" maxLength={500} {...register("institutional_profile_url")} />
        </Field>
        <Field id="lecturer-verification-note" label="Verification information" hint="Help us verify your affiliation. Do not include identity documents or sensitive records." error={errors.verification_note?.message}>
          <Textarea maxLength={2000} {...register("verification_note")} />
        </Field>
      </div>
    </details>
  </div>;
}
