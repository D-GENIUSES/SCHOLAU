"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Flag } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import type { ReportTargetType } from "@scholau/core";
import { REPORT_CATEGORIES, type ReportInput, reportSchema } from "@scholau/core";
import { useReportContent } from "@scholau/api/react";
import { useAnalytics } from "@/lib/analytics";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Field } from "./ui/field";
import { NativeSelect, Textarea } from "./ui/input";
import { InlineError } from "./ui/states";

export function ReportDialog({
  targetType,
  targetId,
  triggerLabel = "Report a problem",
  title = "Report a problem",
  reference,
  controlledOpen,
  onControlledOpenChange,
  onCloseAutoFocus,
}: {
  targetType: ReportTargetType;
  targetId?: string | null;
  triggerLabel?: string;
  title?: string;
  reference?: string;
  controlledOpen?: boolean;
  onControlledOpenChange?: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const id = useId();
  const reportReference = reference ? `\n\nQuestion reference: ${reference}` : "";
  const noteLimit = 2000 - reportReference.length;
  const report = useReportContent();
  const analytics = useAnalytics();
  const form = useForm<ReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: { category: undefined as unknown as ReportInput["category"], note: "" },
  });

  function changeOpen(open: boolean) {
    if (controlledOpen === undefined) setLocalOpen(open);
    else onControlledOpenChange?.(open);
    if (!open) {
      report.reset();
      form.reset();
    }
  }

  const onSubmit = form.handleSubmit((values) => {
    report.mutate(
      { targetType, targetId: targetId ?? null, category: values.category, note: `${values.note}${reportReference}` },
      {
        onSuccess: () => {
          analytics.track({ name: "content_reported", target_type: targetType, category: values.category });
        },
      },
    );
  });

  return (
    <Dialog open={controlledOpen ?? localOpen} onOpenChange={changeOpen}>
      {controlledOpen === undefined ? (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Flag className="size-4" aria-hidden />
            {triggerLabel}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogTitle>{title}</DialogTitle>
        {report.isSuccess ? (
          <>
            <Alert tone="success" title="Thanks — your report was sent" role="status">
              Our content team reviews every report. You can keep going.
            </Alert>
            <DialogFooter>
              <Button onClick={() => changeOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <DialogDescription>Tell us what&apos;s wrong. Please don&apos;t include personal information.</DialogDescription>
            <Field id={`${id}-category`} label="What's wrong?" error={form.formState.errors.category?.message}>
              <NativeSelect {...form.register("category")} defaultValue="">
                <option value="" disabled>
                  Choose a category
                </option>
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id={`${id}-note`} label="Details" error={form.formState.errors.note?.message}>
              <Textarea maxLength={noteLimit} {...form.register("note")} />
            </Field>
            {reference ? <p className="break-words text-xs text-ink-muted">Question reference: {reference}</p> : null}
            <InlineError error={report.error} />
            <DialogFooter>
              <Button type="submit" loading={report.isPending}>
                Send report
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
