"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import type { CourseOverview } from "@scholau/api";
import type { LecturerQuizList } from "@scholau/api";
import { useCourseOverview } from "@scholau/api/react";
import { CourseAssessments } from "@/components/assessments/course-assessments";
import { ErrorState, LoadingState } from "@/components/ui/states";

export function AssessmentsRoute({
  initialOverview,
  initialQuizList,
}: {
  initialOverview?: CourseOverview;
  initialQuizList?: LecturerQuizList;
}) {
  const { offeringId } = useParams<{ offeringId: string }>();
  const requestedTab = useSearchParams().get("tab");
  const initialTab = requestedTab === "mock" || requestedTab === "challenges" || requestedTab === "class-quizzes" ? requestedTab : "quiz";
  const overview = useCourseOverview(offeringId, initialOverview);
  return (
    <div className="mx-auto w-full max-w-3xl min-w-0">
      <Link href="/home" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> My courses
      </Link>
      {overview.data ? (
        <CourseAssessments key={offeringId} data={overview.data} initialTab={initialTab} initialQuizList={initialQuizList} />
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : <LoadingState variant="assessment" label="Loading assessments…" />}
    </div>
  );
}
