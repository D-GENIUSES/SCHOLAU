import type { CatalogOffering } from "@scholau/api";

export function electiveGroups(offerings: CatalogOffering[]) {
  const groups = new Map<string, { name: string; count: number; required: boolean; offerings: CatalogOffering[] }>();
  for (const offering of offerings) {
    if (!offering.elective_group) continue;
    const name = offering.elective_group;
    const group = groups.get(name) ?? { name, count: offering.elective_selection_count ?? 1, required: offering.elective_selection_count != null, offerings: [] };
    group.offerings.push(offering);
    groups.set(name, group);
  }
  return [...groups.values()];
}

export function chosenElectives(offerings: CatalogOffering[], selected: Set<string>) {
  return offerings.filter((o) => o.enrolled || selected.has(o.offering_id)).length;
}

export function toggleElective(offerings: CatalogOffering[], selected: Set<string>, offeringId: string, checked: boolean) {
  const next = new Set(selected);
  if (!checked) {
    next.delete(offeringId);
    return next;
  }
  const offering = offerings.find((o) => o.offering_id === offeringId);
  if (!offering || offering.enrolled) return next;
  if (offering.elective_group) {
    const group = offerings.filter((o) => o.elective_group === offering.elective_group);
    const limit = offering.elective_selection_count ?? 1;
    if (limit === 1 && !group.some((o) => o.enrolled)) {
      group.forEach((o) => next.delete(o.offering_id));
    } else if (chosenElectives(group, next) >= limit) {
      return next;
    }
  }
  next.add(offeringId);
  return next;
}
