"use client";

import { useQuery } from "@tanstack/react-query";
import type { Profile } from "@scholau/api";
import { useScholauApi } from "@scholau/api/react";
import { readRegistrationAcademic, SEMESTER_LABELS, type AcademicProfileInput } from "@scholau/core";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { AcademicProfileForm } from "./academic-profile-form";

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
function uniqueMatch<T>(items: T[], matches: (item: T) => boolean): T | undefined {
  const found = items.filter(matches);
  return found.length === 1 ? found[0] : undefined;
}

export function RegistrationAcademicForm({ profile, onCompleted }: { profile: Profile; onCompleted: () => void }) {
  const api = useScholauApi();
  const defaults = useQuery({
    queryKey: ["scholau", "registration-academic-defaults", profile.id],
    queryFn: async (): Promise<Partial<AcademicProfileInput>> => {
      const { data, error } = await getBrowserSupabase().auth.getUser();
      if (error) throw error;
      const saved = readRegistrationAcademic(data.user?.user_metadata);
      if (!saved) return {};
      const root = await api.getOnboardingOptions({});
      const university = uniqueMatch(root.universities, (item) => item.slug === saved.universitySlug);
      if (!university) return {};
      const options = await api.getOnboardingOptions({ universityId: university.id });
      const result: Partial<AcademicProfileInput> = { universityId: university.id };
      const faculty = uniqueMatch(options.faculties, (item) => normalize(item.name) === normalize(saved.faculty));
      if (faculty) {
        result.facultyId = faculty.id;
        const children = await api.getOnboardingOptions({ universityId: university.id, facultyId: faculty.id });
        const department = uniqueMatch(children.departments, (item) => normalize(item.name) === normalize(saved.department));
        if (department) result.departmentId = department.id;
      }
      // Registration does not yet collect level or session. Never guess among several sessions.
      const period = options.academic_periods[0];
      if (period && options.academic_periods.length === 1) {
        result.academicPeriodId = period.id;
        const children = await api.getOnboardingOptions({ universityId: university.id, academicPeriodId: result.academicPeriodId });
        const semester = uniqueMatch(children.semesters, (item) => normalize(item.label) === normalize(SEMESTER_LABELS[saved.currentSemester]));
        if (semester) result.semesterId = semester.id;
      }
      return result;
    },
    retry: false,
  });
  if (defaults.isPending) return <LoadingState label="Loading your saved study detailsâ€¦" />;
  if (defaults.isError) return <ErrorState error={defaults.error} onRetry={() => void defaults.refetch()} />;
  return <AcademicProfileForm profile={profile} changeMode={false} defaults={defaults.data} onCompleted={onCompleted} />;
}
