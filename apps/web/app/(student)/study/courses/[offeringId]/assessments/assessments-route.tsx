"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { CourseOverview } from "@scholau/api";
import type { LecturerQuizList } from "@scholau/api";
import { isApiError } from "@scholau/api";
import { useCourseOverview, useEnrollCourse } from "@scholau/api/react";
import { CourseAssessments } from "@/components/assessments/course-assessments";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";

export function AssessmentsRoute({
  initialOverview,
  initialQuizList,
  quizListError,
}: {
  initialOverview?: CourseOverview;
  initialQuizList?: LecturerQuizList;
  quizListError?: string;
}) {
  const { offeringId } = useParams<{ offeringId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab = requestedTab === "mock" || requestedTab === "challenges" || requestedTab === "class-quizzes" ? requestedTab : "quiz";
  const overview = useCourseOverview(offeringId, initialOverview);
  const enroll = useEnrollCourse();
  const tabQuery = requestedTab ? `?tab=${encodeURIComponent(requestedTab)}` : "";

  useEffect(() => {
    const resolved = overview.data?.offering_id;
    if (resolved && resolved !== offeringId) {
      router.replace(`/study/courses/${resolved}/assessments${tabQuery}`);
    }
  }, [overview.data?.offering_id, offeringId, router, tabQuery]);

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0">
      <Link href="/home" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> My courses
      </Link>
      {overview.data && overview.data.offering_id === offeringId ? (
        <CourseAssessments
          key={`${offeringId}:${initialTab}`}
          data={overview.data}
          initialTab={initialTab}
          initialQuizList={initialQuizList}
          quizListError={quizListError}
        />
      ) : overview.data && overview.data.offering_id !== offeringId ? (
        <LoadingState variant="assessment" label="Opening your course…" />
      ) : overview.isError ? (
        isApiError(overview.error, "NOT_ENROLLED") ? (
          <EmptyState
            icon={<BookOpen className="size-8" />}
            title="Enroll to open assessments"
            description="You need to be enrolled in this course to see quizzes, challenges and practice."
            action={
              <div className="flex flex-col items-center gap-2">
                <Button
                  loading={enroll.isPending}
                  onClick={() =>
                    enroll.mutate({ offeringId }, { onSuccess: () => void overview.refetch() })
                  }
                >
                  Enroll in this course
                </Button>
                <Button asChild variant="outline">
                  <Link href="/home">Back to my courses</Link>
                </Button>
                <InlineError error={enroll.error} />
              </div>
            }
          />
        ) : (
          <ErrorState
            error={overview.error}
            onRetry={() => void overview.refetch()}
            action={
              <Button asChild variant="outline">
                <Link href="/home">Back to my courses</Link>
              </Button>
            }
          />
        )
      ) : (
        <LoadingState variant="assessment" label="Loading assessments…" />
      )}
    </div>
  );
}
