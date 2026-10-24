"use client";

import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  FileUp,
  Flag,
  GraduationCap,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useAdminCounts } from "@scholau/api/react";
import { formatNumber } from "@scholau/core";
import { AdminErrorState, AdminPageHeader } from "@/components/admin/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

function CountCard({
  label,
  value,
  href,
  hint,
  emphasis,
}: {
  label: string;
  value: number;
  href: string;
  hint: string;
  emphasis?: "warning" | "brand";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-[88px] flex-col justify-center gap-0.5 overflow-hidden rounded-control border bg-surface-card px-3 py-2.5 shadow-card transition hover:border-brand-primary",
        emphasis === "warning" && value > 0 ? "border-warning/40 bg-warning-bg/30" : "border-line",
      )}
    >
      {emphasis === "warning" && value > 0 ? (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-warning" aria-hidden />
      ) : null}
      <span className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{label}</span>
        <ArrowRight
          className="size-3.5 shrink-0 text-ink-muted opacity-0 transition group-hover:opacity-100 group-hover:text-brand-primary"
          aria-hidden
        />
      </span>
      <span className="text-2xl font-bold tabular-nums leading-none text-ink">{formatNumber(value)}</span>
      <span className="text-xs text-ink-muted">{hint}</span>
    </Link>
  );
}

const QUICK_LINKS = [
  { href: "/admin/review?tab=lessons&status=draft", label: "Review drafts", icon: ClipboardCheck },
  { href: "/admin/import", label: "Import content", icon: FileUp },
  { href: "/admin/users", label: "Manage users", icon: UserPlus },
  { href: "/admin/reports", label: "Open reports", icon: Flag },
  { href: "/admin/offerings", label: "Offerings", icon: GraduationCap },
  { href: "/admin/content-sync", label: "Course materials", icon: BookOpen },
] as const;

const STEPS = [
  { title: "Import drafts", body: "Upload question CSV/JSON or lesson JSON. Validate first; imports only ever create drafts." },
  { title: "Review", body: "Read every draft: blocks, prompts, options, the answer key, explanation and source reference." },
  { title: "Publish", body: "Publishing records you as reviewer and makes the version visible. Published versions are immutable." },
  { title: "Retire or replace", body: "To change published content, import a new draft version, publish it, and retire the old one." },
];

export default function AdminOverviewPage() {
  const counts = useAdminCounts();

  return (
    <>
      <AdminPageHeader title="Dashboard" description="Pipeline health, shortcuts, and content workflow." />

      <section aria-label="Quick links" className="mb-5">
        <ul className="flex flex-wrap gap-2">
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-pill border border-line bg-surface-card px-2.5 text-xs font-semibold text-ink-muted shadow-card transition hover:border-brand-primary hover:text-brand-primary"
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="counts-heading" className="mb-5">
        <h2 id="counts-heading" className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
          At a glance
        </h2>
        {counts.isPending ? (
          <LoadingState label="Loading counts…" />
        ) : counts.isError ? (
          <AdminErrorState error={counts.error} onRetry={() => void counts.refetch()} />
        ) : (
          <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6">
            <li>
              <CountCard
                label="Draft lessons"
                value={counts.data.lessonsDraft}
                hint="Awaiting review"
                href="/admin/review?tab=lessons&status=draft"
                emphasis="warning"
              />
            </li>
            <li>
              <CountCard
                label="Draft questions"
                value={counts.data.questionsDraft}
                hint="Awaiting review"
                href="/admin/review?tab=questions&status=draft"
                emphasis="warning"
              />
            </li>
            <li>
              <CountCard
                label="Open reports"
                value={counts.data.reportsOpen}
                hint="Need triage"
                href="/admin/reports"
                emphasis="warning"
              />
            </li>
            <li>
              <CountCard
                label="Published lessons"
                value={counts.data.lessonsPublished}
                hint="Live for students"
                href="/admin/review?tab=lessons&status=published"
              />
            </li>
            <li>
              <CountCard
                label="Published questions"
                value={counts.data.questionsPublished}
                hint="Learning & battles"
                href="/admin/review?tab=questions&status=published"
              />
            </li>
            <li>
              <CountCard
                label="Offerings"
                value={counts.data.offeringsPublished}
                hint="In catalog"
                href="/admin/offerings"
              />
            </li>
          </ul>
        )}
      </section>

      <Card className="shadow-card">
        <CardHeader className="space-y-1 px-4 py-3 sm:px-5">
          <CardTitle className="text-base">Content workflow</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Nothing reaches students until an administrator reviews and publishes it.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          <ol className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-2.5 rounded-control border border-line bg-surface-page/60 p-2.5">
                <span
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-pill bg-brand-primary text-xs font-bold text-ink-inverse"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-ink-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm">
            <Link href="/admin/import" className="font-semibold text-brand-primary underline-offset-4 hover:underline">
              Start an import
            </Link>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
