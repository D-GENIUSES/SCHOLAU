"use client";

import { cn } from "@/lib/utils";

/** Segmented control implemented as a native radio group (keyboard arrows work out of the box). */
export function Segmented<V extends string>({
  name,
  legend,
  value,
  onChange,
  options,
  className,
}: {
  name: string;
  legend: string;
  value: V;
  onChange: (v: V) => void;
  options: readonly { value: V; label: string }[];
  className?: string;
}) {
  return (
    <fieldset className={cn("inline-flex", className)}>
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex max-w-full rounded-pill border border-line bg-surface-page p-1">
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          const checked = o.value === value;
          return (
            <div key={o.value} className="relative">
              <input
                type="radio"
                id={id}
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="peer absolute inset-0 cursor-pointer opacity-0"
              />
              <label
                htmlFor={id}
                className={cn(
                  "inline-flex min-h-10 cursor-pointer items-center rounded-pill px-4 text-sm font-semibold transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-primary",
                  checked ? "bg-surface-card text-ink shadow-card" : "text-ink-muted hover:text-ink",
                )}
              >
                {o.label}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
