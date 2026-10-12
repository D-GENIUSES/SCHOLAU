import * as React from "react";
import { cn } from "@/lib/utils";

const badgeTones = {
  neutral: "bg-surface-page text-ink-muted border-line",
  brand: "bg-surface-tint text-brand-primary border-[#cfe3fb]",
  success: "bg-success-bg text-success border-[#b8e0cc]",
  warning: "bg-warning-bg text-warning border-[#f0d9a8]",
  danger: "bg-danger-bg text-danger border-[#f3c4bf]",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Progress({
  value,
  label,
  className,
  tone = "brand",
}: {
  value: number;
  label: string;
  className?: string;
  tone?: "brand" | "success" | "warning";
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className={cn("h-2.5 w-full overflow-hidden rounded-pill bg-surface-tint", className)}
    >
      <div
        className={cn(
          "h-full rounded-pill transition-[width] duration-500",
          tone === "brand" && "bg-brand-primary",
          tone === "success" && "bg-success",
          tone === "warning" && "bg-warning",
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-control bg-[#e3ecf6]", className)} />;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow ? <div className="text-sm font-semibold text-brand-primary">{eyebrow}</div> : null}
        <h1 className="text-2xl font-bold lg:text-[32px]">{title}</h1>
        {description ? <p className="text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-control border border-line bg-surface-card p-3">
      {icon ? (
        <span className="inline-flex size-10 items-center justify-center rounded-pill bg-surface-tint text-brand-primary" aria-hidden>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <div className="text-sm text-ink-muted">{label}</div>
        <div className="text-lg font-bold text-ink">{value}</div>
      </div>
    </div>
  );
}

/** Polite live region for save/answer feedback. */
export function LiveRegion({ children, assertive }: { children: React.ReactNode; assertive?: boolean }) {
  return (
    <div role={assertive ? "alert" : "status"} aria-live={assertive ? "assertive" : "polite"} className="sr-only">
      {children}
    </div>
  );
}
