import { z } from "zod";
import { NIGERIAN_UNIVERSITIES } from "@scholau/core";

const named = z.object({ id: z.string().uuid(), name: z.string() });
export const lecturerCatalogueSchema = z.object({
  university_id: z.string().uuid(), faculties: z.array(named),
  departments: z.array(named.extend({ faculty_id: z.string().uuid() })),
});
export const lecturerCoursesSchema = z.array(z.object({ id: z.string().uuid(), code: z.string(), title: z.string() }));
export const NOT_LISTED = "__not_listed__";
export const lecturerUniversities = [...NIGERIAN_UNIVERSITIES]
  .sort((a, b) => a.label.localeCompare(b.label, "en-NG", { sensitivity: "base" }));

/** Matching displays a selector without rewriting saved application text. */
export function savedChoice(options: readonly { value: string; label: string }[], text: string) {
  if (!text) return "";
  const matches = options.filter(item => item.label.trim().toLowerCase() === text.trim().toLowerCase());
  return matches.length === 1 ? matches[0]!.value : NOT_LISTED;
}

export function courseRequest(selected: readonly { label: string }[], manual: string | null) {
  if (manual !== null && manual.trim().length < 2) return "";
  return [...selected.map(item => item.label), ...(manual === null ? [] : [manual])].join("\n");
}
