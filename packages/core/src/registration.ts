import { NIGERIAN_UNIVERSITIES } from "./nigerian-universities";
import { registrationAcademicSchema, type RegistrationAcademicInput } from "./schemas";

export const SEMESTER_LABELS = { first: "First semester", second: "Second semester", third: "Third semester" } as const;

/** Only form data; never use user-editable metadata for roles or enrollment authorization. */
export function readRegistrationAcademic(metadata: unknown): RegistrationAcademicInput | null {
  if (!metadata || typeof metadata !== "object" || !("academic_profile" in metadata)) return null;
  const parsed = registrationAcademicSchema.safeParse(metadata.academic_profile);
  return parsed.success ? parsed.data : null;
}

export function registrationAcademicMetadata(values: RegistrationAcademicInput) {
  const parsed = registrationAcademicSchema.parse(values);
  const university = NIGERIAN_UNIVERSITIES.find((item) => item.value === parsed.universitySlug)!;
  return { academic_profile: { ...parsed, universityName: university.label } };
}

/** Prefixes of names, words and common abbreviations; results retain alphabetical order. */
export function filterAcademicOptions<T extends { label: string; searchTerms?: string }>(options: readonly T[], search: string): T[] {
  const query = search.trim().toLocaleLowerCase("en-NG").replace(/\s+/g, " ");
  if (!query) return [...options];
  return options.filter((option) => {
    const label = option.label.toLocaleLowerCase("en-NG");
    const aliases = option.searchTerms?.toLocaleLowerCase("en-NG") ?? "";
    return label.startsWith(query) || label.split(/[\s,()-]+/).some((word) => word.startsWith(query))
      || (query.length > 1 && label.includes(query)) || aliases.split(/\s+/).some((alias) => alias.startsWith(query));
  });
}
