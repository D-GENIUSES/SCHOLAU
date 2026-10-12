"use client";

import { ArrowRight, BookOpen, CircleHelp, Flag, GraduationCap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAdminCounts } from "@scholau/api/react";
import { formatNumber } from "@scholau/core";
import { AdminErrorState } from "@/components/admin/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { LoadingState } from "@/components/ui/states";

function CountCard({ label, value, href, hint, icon }: { label: string; value: number; href: string; hint: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-card border border-line bg-surface-card p-4 shadow-card transition-colors hover:border-brand-primary"
    >
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-surface-tint text-brand-primary" aria-hidden>
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-ink-muted">{label}</span>
        <span className="text-2xl font-bold text-ink">{formatNumber(value)}</span>
        <span className="text-sm text-ink-muted">{hint}</span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-ink-muted group-hover:text-brand-primary" aria-hidden />
    </Link>
  );
}

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
      <PageHeader eyebrow="Admin" title="Overview" description="Content pipeline, reports and support tools." />

      <section aria-labelledby="counts-heading" className="mb-8">
        <h2 id="counts-heading" className="sr-only">
          Counts
        </h2>
        {counts.isPending ? (
          <LoadingState label="Loading counts…" />
        ) : counts.isError ? (
          <AdminErrorState error={counts.error} onRetry={() => void counts.refetch()} />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <li>
              <CountCard
                label="Draft lessons"
                value={counts.data.lessonsDraft}
                hint="Waiting for review"
                href="/admin/review?tab=lessons&status=draft"
                icon={<BookOpen className="size-5" />}
              />
            </li>
            <li>
              <CountCard
                label="Published lessons"
                value={counts.data.lessonsPublished}
                hint="Live for enrolled students"
                href="/admin/review?tab=lessons&status=published"
                icon={<BookOpen className="size-5" />}
              />
            </li>
            <li>
              <CountCard
                label="Draft questions"
                value={counts.data.questionsDraft}
                hint="Waiting for review"
                href="/admin/review?tab=questions&status=draft"
                icon={<CircleHelp className="size-5" />}
              />
            </li>
            <li>
              <CountCard
                label="Published questions"
                value={counts.data.questionsPublished}
                hint="Learning and battle pools"
                href="/admin/review?tab=questions&status=published"
                icon={<CircleHelp className="size-5" />}
              />
            </li>
            <li>
              <CountCard
                label="Published offerings"
                value={counts.data.offeringsPublished}
                hint="Visible in the catalog"
                href="/admin/offerings"
                icon={<GraduationCap className="size-5" />}
              />
            </li>
            <li>
              <CountCard
                label="Open reports"
                value={counts.data.reportsOpen}
                hint="Need triage"
                href="/admin/reports"
                icon={<Flag className="size-5" />}
              />
            </li>
          </ul>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Content workflow</CardTitle>
          <CardDescription>Nothing reaches students until an administrator reviews and publishes it.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3 rounded-control border border-line p-3">
                <span
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-pill bg-brand-primary text-sm font-bold text-ink-inverse"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </h3>
                  <p className="text-sm text-ink-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm">
            <Link href="/admin/import" className="font-semibold text-brand-primary underline-offset-4 hover:underline">
              Start an import
            </Link>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
