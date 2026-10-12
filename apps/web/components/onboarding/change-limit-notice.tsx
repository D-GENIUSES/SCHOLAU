"use client";

import { ReportDialog } from "@/components/report-dialog";
import { Alert } from "@/components/ui/alert";

/** Shown once the student's single self-service academic change for the period is used. */
export function ChangeLimitNotice({ className }: { className?: string }) {
  return (
    <Alert
      tone="info"
      className={className}
      title="Further corrections need an administrator"
      action={<ReportDialog targetType="technical" triggerLabel="Contact support" title="Contact support" />}
    >
      You&apos;ve already changed your academic profile this academic period. If your details are wrong, contact support and an
      administrator can correct them for you.
    </Alert>
  );
}
