import * as React from "react";
import { cn } from "@/lib/utils";

/** Checkbox with its label to the right; the whole label is a >=44px hit target. */
export const CheckboxField = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { id: string; label: React.ReactNode; hint?: React.ReactNode; error?: string }
>(({ id, label, hint, error, className, ...props }, ref) => {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          className="mt-3 size-5 shrink-0 accent-brand-primary"
          {...props}
        />
        <label htmlFor={id} className="flex min-h-11 flex-1 items-center py-2 text-ink">
          {label}
        </label>
      </div>
      {hint ? (
        <p id={hintId} className="pl-8 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="pl-8 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
});
CheckboxField.displayName = "CheckboxField";
