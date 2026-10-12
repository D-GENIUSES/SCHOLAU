import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const styles = {
  info: { box: "border-[#cfe3fb] bg-surface-tint text-ink", icon: Info, iconClass: "text-brand-primary" },
  success: { box: "border-[#b8e0cc] bg-success-bg text-ink", icon: CheckCircle2, iconClass: "text-success" },
  warning: { box: "border-[#f0d9a8] bg-warning-bg text-ink", icon: AlertTriangle, iconClass: "text-warning" },
  error: { box: "border-[#f3c4bf] bg-danger-bg text-ink", icon: XCircle, iconClass: "text-danger" },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
  role,
}: {
  tone?: keyof typeof styles;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  const s = styles[tone];
  const Icon = s.icon;
  return (
    <div role={role} className={cn("flex gap-3 rounded-control border p-4", s.box, className)}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", s.iconClass)} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-sm text-ink">{children}</div> : null}
        {action ? <div className="mt-2 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
