import type { LecturerOffering } from "@scholau/core";

export type SharedCourseGroup = {
  key: string;
  courseId: string;
  semester: string;
  period: string;
  code: string;
  title: string;
  university: string;
  facultyId: string;
  faculty: string;
  departmentId: string;
  department: string;
  offeringIds: string[];
  sharedDepartments: string[];
};

function groupKey(offering: LecturerOffering) {
  return `${offering.course_id ?? offering.code}::${offering.period}::${offering.semester}`;
}

function hostRank(department: string) {
  return department === "Computer Science" ? 0 : 1;
}

/** One row per shared course+semester; host prefers Computer Science. */
export function groupSharedCourseOfferings(offerings: LecturerOffering[]): SharedCourseGroup[] {
  const buckets = new Map<string, LecturerOffering[]>();
  for (const offering of offerings) {
    const key = groupKey(offering);
    const list = buckets.get(key) ?? [];
    list.push(offering);
    buckets.set(key, list);
  }

  const groups: SharedCourseGroup[] = [];
  for (const [key, items] of buckets) {
    const sorted = [...items].sort(
      (a, b) => hostRank(a.department) - hostRank(b.department) || a.department.localeCompare(b.department) || a.id.localeCompare(b.id),
    );
    const host = sorted[0]!;
    const offeringIds = [...new Set(sorted.map(item => item.id))].sort();
    const sharedDepartments = [
      ...new Set(
        sorted
          .map(item => item.department)
          .filter(name => name !== host.department)
          .concat(host.shared_departments ?? []),
      ),
    ].sort((a, b) => a.localeCompare(b));

    groups.push({
      key,
      courseId: host.course_id ?? host.code,
      semester: host.semester,
      period: host.period,
      code: host.code,
      title: host.title,
      university: host.university,
      facultyId: host.faculty_id ?? "",
      faculty: host.faculty ?? "",
      departmentId: host.department_id ?? "",
      department: host.department,
      offeringIds,
      sharedDepartments,
    });
  }

  return groups.sort(
    (a, b) =>
      a.university.localeCompare(b.university) ||
      a.faculty.localeCompare(b.faculty) ||
      a.code.localeCompare(b.code) ||
      a.department.localeCompare(b.department),
  );
}

export function facultiesFromOfferings(offerings: LecturerOffering[]) {
  const map = new Map<string, { id: string; label: string }>();
  for (const offering of offerings) {
    if (!offering.faculty_id || !offering.faculty) continue;
    if (!map.has(offering.faculty_id)) {
      map.set(offering.faculty_id, {
        id: offering.faculty_id,
        label: `${offering.university} · ${offering.faculty}`,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function groupIsSelected(group: SharedCourseGroup, selectedIds: string[]) {
  const selected = new Set(selectedIds);
  return group.offeringIds.some(id => selected.has(id));
}

export function toggleSharedCourseGroup(selectedIds: string[], group: SharedCourseGroup, checked: boolean) {
  const remove = new Set(group.offeringIds);
  const next = selectedIds.filter(id => !remove.has(id));
  return checked ? [...next, ...group.offeringIds] : next;
}
