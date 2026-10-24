"use client";

import { useEffect, useState } from "react";
import type { HomeSummary } from "@scholau/api";
import { useCourseOverview } from "@scholau/api/react";
import Link from "next/link";
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
  const [offeringId, setOfferingId] = useState<string | null>(() => resolveHomeOfferingId(summary, null));

  useEffect(() => {
    const stored = readStoredHomeOfferingId();
    setOfferingId(resolveHomeOfferingId(summary, stored));
  }, [summary]);

  const enrolled = summary.enrolled_courses.find((c) => c.offering_id === offeringId);
  const isPreviewOffering = Boolean(offeringId?.startsWith("preview-"));
  const overviewQuery = useCourseOverview(isPreviewOffering ? undefined : offeringId ?? undefined);
  const overview = isPreviewOffering && enrolled ? buildPreviewCourseOverview(enrolled) : overviewQuery.data ?? null;
  const continueLessonId =
    summary.continue_learning?.offering_id === offeringId ? summary.continue_learning.lesson_id : null;

  const selectOffering = (id: string) => {
    setOfferingId(id);
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
            <Link href="/study">Go to Study</Link>
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
        <h1>{enrolled.title}</h1>
        <p>{enrolled.code}</p>
      </header>
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
