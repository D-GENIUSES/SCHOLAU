"use client";

import * as React from "react";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";

const SEARCH_THRESHOLD = 8;

export interface AcademicOption {
  value: string;
  label: string;
}

/** Labelled native select; long lists except departments get a filter input above. */
export function AcademicSelect({
  id,
  label,
  noun,
  hint,
  error,
  options,
  loading,
  value,
  onChange,
  onBlur,
  selectRef,
  filterable,
}: {
  id: string;
  label: string;
  /** Plural noun for the filter label, e.g. "universities". */
  noun: string;
  /** When false, never show the search filter (sign-up study step). */
  filterable?: boolean;
  hint?: string;
  error?: string;
  options: AcademicOption[];
  loading?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  selectRef?: React.Ref<HTMLSelectElement>;
}) {
  const [filter, setFilter] = React.useState("");
  const searchable = filterable !== false && noun !== "departments" && options.length > SEARCH_THRESHOLD;
  const query = filter.trim().toLowerCase();
  const visible = searchable && query ? options.filter((o) => o.value === value || o.label.toLowerCase().includes(query)) : options;

  if (loading || options.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <p
          role={loading ? "status" : undefined}
          className="flex min-h-12 items-center rounded-control border border-dashed border-line px-3 text-ink-muted"
        >
          {loading ? "Loading options…" : `No ${noun} are available for this selection yet.`}
        </p>
        {error && !loading ? <p className="text-sm font-medium text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {searchable ? (
        <Field id={`${id}-filter`} label={`Filter ${noun}`} hint={query ? `${visible.length} shown` : undefined}>
          <Input type="search" autoComplete="off" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </Field>
      ) : null}
      <Field id={id} label={label} hint={hint} error={error}>
        <NativeSelect ref={selectRef} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}>
          <option value="" disabled>
            Choose…
          </option>
          {visible.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}
