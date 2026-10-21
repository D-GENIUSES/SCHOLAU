"use client";

import { BookOpen, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type CatalogOffering, isApiError } from "@scholau/api";
import { useCatalog, useEnrollCourse, useProfile } from "@scholau/api/react";
import { COPY, errorMessage, pluralize } from "@scholau/core";
import { ReportDialog } from "@/components/report-dialog";
import { Button } from "@/components/ui/button";
import { Badge, PageHeader } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

function AcademicSummary() {
  const { data } = useProfile();
  const a = data?.academic;
  if (!a) return null;
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-1 text-left text-sm sm:grid-cols-[auto_1fr]">
      {[
        ["University", a.university.name],
        ["Department", a.department.name],
        ["Level", a.level.label],
        ["Semester", `${a.semester.label}, ${a.academic_period.label}`],
      ].map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold text-ink">{k}</dt>
          <dd className="text-ink-muted">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function NoCourses() {
  return (
    <EmptyState
      icon={<BookOpen className="size-6" />}
      title={COPY.empty.noCourse}
      description={
        <>
          <p>We don&apos;t have published courses for these academic details yet:</p>
          <AcademicSummary />
          <p className="mt-3">If these details are wrong you can change them, or let us know which course you need.</p>
        </>
      }
      action={
        <>
          <Button asChild variant="outline">
            <Link href="/onboarding?change=1">Change academic details</Link>
          </Button>
          <ReportDialog targetType="technical" triggerLabel="Contact support" title="Contact support" />
          <Button asChild>
            <Link href="/home">Skip for now</Link>
          </Button>
        </>
      }
    />
  );
}

function CourseOption({
  offering,
  checked,
  disabled,
  error,
  onToggle,
}: {
  offering: CatalogOffering;
  checked: boolean;
  disabled: boolean;
  error?: unknown;
  onToggle: (checked: boolean) => void;
}) {
  const id = `course-${offering.offering_id}`;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <li
      className={cn(
        "rounded-card border bg-surface-card transition-colors",
        checked && !offering.enrolled ? "border-brand-primary" : "border-line",
        error ? "border-danger" : null,
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <input
          id={id}
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-brand-primary"
          checked={offering.enrolled || checked}
          disabled={offering.enrolled || disabled || (offering.requirement_status !== "E" && !offering.elective_group)}
          aria-describedby={errorId}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-ink">{offering.course.code}</span>
            {offering.enrolled ? (
              <Badge tone="success">
                <CheckCircle2 className="size-4" aria-hidden />
                Assigned
              </Badge>
            ) : null}
          </span>
          <span className="text-ink">{offering.course.title}</span>
          {offering.elective_group ? <span className="text-sm font-semibold text-ink-muted">Choose one elective from this group</span> : null}
          {offering.unit_count != null ? <span className="text-sm text-ink-muted">{pluralize(offering.unit_count, "unit")} · Status {offering.requirement_status}</span> : null}
          <span className="text-sm text-ink-muted">{offering.lesson_count === 0 ? "Content coming soon" : pluralize(offering.lesson_count, "lesson")}</span>
        </label>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="border-t border-[#f3c4bf] bg-danger-bg px-4 py-2 text-sm font-medium text-danger">
          Couldn&apos;t enroll: {isApiError(error) ? errorMessage(error) : "Something went wrong. Please try again."}
        </p>
      ) : null}
    </li>
  );
}

export function CoursePicker() {
  const router = useRouter();
  const catalog = useCatalog();
  const enroll = useEnrollCourse();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [failures, setFailures] = useState<Record<string, unknown>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const needsOnboarding = catalog.data?.needs_onboarding === true;

  useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding");
  }, [needsOnboarding, router]);

  if (catalog.isError) return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;
  if (catalog.isPending || needsOnboarding) return <LoadingState variant="courses" label="Loading courses…" />;

  const offerings = catalog.data.offerings;
  const enrolledCount = offerings.filter((o) => o.enrolled).length;
  const running = progress !== null;

  const toggle = (offeringId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        const group = offerings.find((o) => o.offering_id === offeringId)?.elective_group;
        if (group) offerings.filter((o) => o.elective_group === group).forEach((o) => next.delete(o.offering_id));
        next.add(offeringId);
      }
      else next.delete(offeringId);
      return next;
    });
  };

  const enrollSelected = async () => {
    const ids = offerings.filter((o) => selected.has(o.offering_id) && !o.enrolled).map((o) => o.offering_id);
    const failed: Record<string, unknown> = {};
    setFailures({});
    setProgress({ done: 0, total: ids.length });
    for (const [i, offeringId] of ids.entries()) {
      try {
        await enroll.mutateAsync({ offeringId });
      } catch (err) {
        if (isApiError(err, "INVALID_PROFILE")) {
          router.replace("/onboarding");
          return;
        }
        failed[offeringId] = err;
      }
      setProgress({ done: i + 1, total: ids.length });
    }
    if (Object.keys(failed).length === 0) {
      router.push("/home");
      return;
    }
    setFailures(failed);
    setSelected(new Set(Object.keys(failed)));
    setProgress(null);
  };

  const selectable = offerings.filter((o) => !o.enrolled && (o.requirement_status === "E" || o.elective_group));
  const selectedCount = selectable.filter((o) => selected.has(o.offering_id)).length;
  const failedCount = Object.keys(failures).length;

  return (
    <>
      <PageHeader
        eyebrow="Your course assignments"
        title="Your courses"
        description="Required courses are assigned automatically from your saved academic profile. Select any electives you want to add."
      />
      {offerings.length === 0 ? (
        <NoCourses />
      ) : (
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-lg font-bold">Courses for your semester</legend>
            <ul className="flex flex-col gap-3">
              {offerings.map((o) => (
                <CourseOption
                  key={o.offering_id}
                  offering={o}
                  checked={selected.has(o.offering_id)}
                  disabled={running || Boolean(o.elective_group && offerings.some((other) => other.enrolled && other.elective_group === o.elective_group && other.offering_id !== o.offering_id))}
                  error={failures[o.offering_id]}
                  onToggle={(checked) => toggle(o.offering_id, checked)}
                />
              ))}
            </ul>
          </fieldset>

          <p role="status" aria-live="polite" className="text-ink-muted">
            {progress
              ? `Enrolling ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
              : failedCount > 0
                ? `${pluralize(failedCount, "course")} couldn't be enrolled. Try again or skip for now.`
                : `${enrolledCount} assigned${selectable.length > 0 ? ` · ${selectedCount} electives selected` : ""}`}
          </p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button asChild variant="ghost">
              <Link href="/home">Continue to home</Link>
            </Button>
            {selectable.length > 0 ? <Button onClick={() => void enrollSelected()} loading={running} disabled={selectedCount === 0}>
              Add electives and continue
            </Button> : null}
          </div>
        </div>
      )}
    </>
  );
}
