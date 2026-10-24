"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Segmented control implemented as a native radio group (keyboard arrows work out of the box). */
export function Segmented<V extends string>({
  name,
  legend,
  value,
  onChange,
  options,
  className,
  equalWidth = false,
}: {
  name: string;
  legend: string;
  value: V;
  onChange: (v: V) => void;
  options: readonly { value: V; label: string; icon?: ReactNode }[];
  className?: string;
  /** Stretch segments to share one row evenly (better on narrow screens). */
  equalWidth?: boolean;
}) {
  return (
    <fieldset className={cn(equalWidth ? "block w-full min-w-0" : "inline-flex", className)}>
      <legend className="sr-only">{legend}</legend>
      <div
        className={cn(
          "max-w-full rounded-pill border border-line bg-surface-page p-1",
          equalWidth ? "flex w-full" : "inline-flex",
        )}
      >
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          const checked = o.value === value;
          return (
            <div key={o.value} className={cn("relative min-w-0", equalWidth && "flex-1")}>
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
                  "inline-flex min-h-10 cursor-pointer items-center rounded-pill px-3 text-sm font-semibold transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-primary sm:px-4",
                  equalWidth && "w-full justify-center gap-1.5",
                  checked ? "bg-surface-card text-ink shadow-card" : "text-ink-muted hover:text-ink",
                )}
              >
                {o.icon ? (
                  <span className={cn("inline-flex shrink-0", checked ? "text-brand-primary" : "opacity-70")} aria-hidden>
                    {o.icon}
                  </span>
                ) : null}
                <span className="truncate">{o.label}</span>
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
