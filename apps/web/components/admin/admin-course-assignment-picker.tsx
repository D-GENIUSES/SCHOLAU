"use client";

import { useMemo, useState } from "react";
import type { LecturerOffering } from "@scholau/core";
import {
  facultiesFromOfferings,
  groupIsSelected,
  groupSharedCourseOfferings,
  toggleSharedCourseGroup,
} from "@/lib/shared-course-offerings";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";

type Props = {
  offerings: LecturerOffering[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  lockedIds?: string[];
  searchId?: string;
  facultyId?: string;
  emptyLabel?: string;
  requireFaculty?: boolean;
};

export function AdminCourseAssignmentPicker({
  offerings,
  selectedIds,
  onChange,
  disabled = false,
  lockedIds = [],
  searchId = "course-assignment-search",
  facultyId = "course-assignment-faculty",
  emptyLabel = "No course offerings match this search.",
  requireFaculty = true,
}: Props) {
  const [faculty, setFaculty] = useState("");
  const [search, setSearch] = useState("");
  const faculties = useMemo(() => facultiesFromOfferings(offerings), [offerings]);
  const locked = useMemo(() => new Set(lockedIds), [lockedIds]);

  const groups = useMemo(() => {
    const scoped = faculty ? offerings.filter(o => o.faculty_id === faculty) : requireFaculty ? [] : offerings;
    const needle = search.trim().toLowerCase();
    return groupSharedCourseOfferings(scoped).filter(group => {
      if (!needle) return true;
      const haystack = `${group.code} ${group.title} ${group.university} ${group.faculty} ${group.department} ${group.sharedDepartments.join(" ")}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [offerings, faculty, requireFaculty, search]);

  const selectedCount = useMemo(() => {
    const selected = new Set(selectedIds);
    return groupSharedCourseOfferings(offerings).filter(group => group.offeringIds.some(id => selected.has(id))).length;
  }, [offerings, selectedIds]);

  return (
    <div className="flex flex-col gap-3">
      <Field id={facultyId} label="Faculty">
        <NativeSelect
          value={faculty}
          disabled={disabled}
          onChange={e => setFaculty(e.target.value)}
        >
          <option value="">{requireFaculty ? "Select a faculty first" : "All faculties"}</option>
          {faculties.map(item => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </NativeSelect>
      </Field>
      {requireFaculty && !faculty ? (
        <p className="text-sm text-ink-muted">Choose a faculty to see its published courses.</p>
      ) : (
        <>
          <Field id={searchId} label="Find a course">
            <Input
              value={search}
              disabled={disabled}
              onChange={e => setSearch(e.target.value)}
              placeholder="Course code, title or department"
            />
          </Field>
          <p className="text-sm">{selectedCount} course{selectedCount === 1 ? "" : "s"} selected</p>
          <div className="max-h-64 overflow-y-auto rounded-control border border-line">
            {groups.map(group => {
              const checked = groupIsSelected(group, selectedIds) || group.offeringIds.some(id => locked.has(id));
              const isLocked = group.offeringIds.some(id => locked.has(id));
              return (
                <label key={group.key} className="flex items-start gap-3 border-t border-line px-3 py-3 text-sm first:border-t-0">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0"
                    checked={checked}
                    disabled={disabled || isLocked}
                    onChange={e => onChange(toggleSharedCourseGroup(selectedIds, group, e.target.checked))}
                  />
                  <span>
                    <strong>
                      {group.code} · {group.title}
                    </strong>
                    {isLocked ? <span className="ml-2 text-xs text-brand-primary">Requested · assigned automatically</span> : null}
                    <span className="block text-xs text-ink-muted">
                      {group.university} · {group.faculty || "Faculty"} · {group.department} · {group.period} · {group.semester}
                    </span>
                    {group.sharedDepartments.length ? (
                      <span className="block text-xs text-ink-muted">
                        Also taught for: {group.sharedDepartments.join(", ")}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
            {!groups.length ? <p className="p-3 text-sm text-ink-muted">{emptyLabel}</p> : null}
          </div>
        </>
      )}
    </div>
  );
}
