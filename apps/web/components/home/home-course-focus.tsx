"use client";

import { useMemo, useState } from "react";
import type { HomeSummary } from "@scholau/api";
import { useCourseOverview } from "@scholau/api/react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import {
  readStoredHomeOfferingId,
  resolveHomeOfferingId,
  writeStoredHomeOfferingId,
} from "@/lib/home-course-selection";
import { CourseSelector } from "./course-selector";
import { CourseLearningMap } from "./course-learning-map";
import { buildPreviewCourseOverview } from "./home-preview-overview";

export function HomeCourseFocus({ summary }: { summary: HomeSummary }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userPick, setUserPick] = useState<string | null>(null);
  const offeringId = useMemo(() => {
    if (userPick && summary.enrolled_courses.some((c) => c.offering_id === userPick)) return userPick;
    return resolveHomeOfferingId(summary, readStoredHomeOfferingId());
  }, [summary, userPick]);

  const enrolled = summary.enrolled_courses.find((c) => c.offering_id === offeringId);
  const isPreviewOffering = Boolean(offeringId?.startsWith("preview-"));
  const overviewQuery = useCourseOverview(isPreviewOffering ? undefined : offeringId ?? undefined);
  const overview = isPreviewOffering && enrolled ? buildPreviewCourseOverview(enrolled) : overviewQuery.data ?? null;
  const continueLessonId =
    summary.continue_learning?.offering_id === offeringId ? summary.continue_learning.lesson_id : null;

  const selectOffering = (id: string) => {
    setUserPick(id);
    writeStoredHomeOfferingId(id);
  };

  if (summary.enrolled_courses.length === 0) {
    return (
      <EmptyState
        title="Your courses"
        description="Complete your academic profile to find your course assignments."
        action={
          <Button asChild>
            <Link href="/onboarding/courses">View assignments</Link>
          </Button>
        }
      />
    );
  }

  if (!offeringId || !enrolled) {
    return (
      <EmptyState
        title="Choose a course"
        description="Select a course from your assignments to start learning."
        action={
          <Button asChild variant="outline">
            <Link href="/home">Go to Home</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="home-course-focus">
      <CourseSelector
        courses={summary.enrolled_courses}
        selectedId={offeringId}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        onSelect={selectOffering}
      />
      <header className="home-course-heading">
        <div>
          <h1>{enrolled.title}</h1>
          <p>{enrolled.code}</p>
        </div>
        {overview && overview.assessments.length > 0 ? (
          <Button asChild variant="secondary" size="sm" className="w-full sm:w-auto">
            <Link href={`/study/courses/${overview.offering_id}#practice`}>
              Open assessments <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </header>
      {continueLessonId && summary.continue_learning ? (
        <section className="home-continue-banner" aria-label="Continue learning">
          <div className="home-continue-banner-copy">
            <p className="home-continue-banner-label">Up next</p>
            <p className="home-continue-banner-title">{summary.continue_learning.title}</p>
          </div>
          <Button asChild size="sm">
            <Link href={`/study/lessons/${continueLessonId}`}>
              {summary.continue_learning.kind === "resume" ? "Continue lesson" : "Start lesson"}
            </Link>
          </Button>
        </section>
      ) : null}
      {!isPreviewOffering && overviewQuery.isError ? (
        <ErrorState error={overviewQuery.error} onRetry={() => void overviewQuery.refetch()} />
      ) : (
        <CourseLearningMap
          overview={overview}
          continueLessonId={continueLessonId}
          loading={!isPreviewOffering && overviewQuery.isPending}
        />
      )}
    </div>
  );
}
