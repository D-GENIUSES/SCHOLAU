"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { useCourseOverview } from "@scholau/api/react";
import { CourseAssessments } from "@/components/assessments/course-assessments";
import { ErrorState, LoadingState } from "@/components/ui/states";

export default function CourseAssessmentsPage() {
  return <Suspense fallback={<LoadingState variant="assessment" label="Loading assessments…" />}><AssessmentsRoute /></Suspense>;
}

function AssessmentsRoute() {
  const { offeringId } = useParams<{ offeringId: string }>();
  const requestedTab = useSearchParams().get("tab");
  const initialTab = requestedTab === "mock" || requestedTab === "challenges" || requestedTab === "class-quizzes" ? requestedTab : "quiz";
  const overview = useCourseOverview(offeringId);
  return (
    <div className="mx-auto w-full max-w-3xl min-w-0">
      <Link href="/home" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> My courses
      </Link>
      {overview.data ? <CourseAssessments key={`${offeringId}-${initialTab}`} data={overview.data} initialTab={initialTab} /> : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : <LoadingState variant="assessment" label="Loading assessments…" />}
    </div>
  );
}
