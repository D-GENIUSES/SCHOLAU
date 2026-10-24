"use client";

import { ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useCatalog, useEnrollCourse, useHomeSummary, useProfile } from "@scholau/api/react";
import { COPY } from "@scholau/core";
import { academicSummary, CourseCard } from "@/components/lesson/course-card";
import { ReportDialog } from "@/components/report-dialog";
import { ContinueLearningCard } from "@/components/home/learning-panels";
import { Button } from "@/components/ui/button";
import { LiveRegion, PageHeader } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";

type Tab = "enrolled" | "available";

export default function StudyPage() {
  const catalog = useCatalog();
  const profile = useProfile();
  const home = useHomeSummary();
  const enroll = useEnrollCourse();
  const [tabChoice, setTab] = useState<Tab | null>(null);
  const academic = academicSummary(profile.data?.academic);

  const header = (
    <PageHeader
      title="Study"
      description="Your courses, lessons, and practice tests."
      actions={
        <Button asChild variant="outline">
          <Link href="/onboarding/courses">
            <ListChecks className="size-4" aria-hidden /> View assignments
          </Link>
        </Button>
      }
    />
  );

  if (catalog.isPending) {
    return (
      <>
        {header}
        <LoadingState variant="courses" label="Loading your courses…" />
      </>
    );
  }
  if (catalog.isError) {
    return (
      <>
        {header}
        <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />
      </>
    );
  }

  const offerings = catalog.data.offerings;
  const enrolled = offerings.filter((o) => o.enrolled);
  const available = offerings.filter((o) => !o.enrolled && (o.requirement_status === "E" || o.elective_group));
  const tab: Tab = tabChoice ?? (enrolled.length > 0 || available.length === 0 ? "enrolled" : "available");

  if (catalog.data.needs_onboarding) {
    return (
      <>
        {header}
        <EmptyState
          title="Finish setting up your academic profile"
          description="Tell us your university, department, level and semester to see your courses."
          action={
            <Button asChild>
              <Link href="/onboarding">Continue setup</Link>
            </Button>
          }
        />
      </>
    );
  }

  if (offerings.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          title={COPY.empty.noCourse}
          description={
            academic ? (
              <>
                We looked for courses for <strong className="text-ink">{academic}</strong>
                {profile.data?.academic ? ` at ${profile.data.academic.university.name}` : ""}.
              </>
            ) : undefined
          }
          action={
            <>
              <Button asChild variant="outline">
                <Link href="/profile">Review academic details</Link>
              </Button>
              <ReportDialog targetType="technical" triggerLabel="Contact support" title="Contact support" />
            </>
          }
        />
      </>
    );
  }

  const list = tab === "enrolled" ? enrolled : available;

  return (
    <>
      {header}
      {tab === "enrolled" && home.data?.continue_learning ? (
        <div className="mb-7">
          <ContinueLearningCard
            item={home.data.continue_learning}
            firstLesson={home.data.enrolled_courses.every((c) => c.lessons_completed === 0)}
            course={home.data.enrolled_courses.find((c) => c.offering_id === home.data?.continue_learning?.offering_id)}
          />
        </div>
      ) : null}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Segmented<Tab>
          name="study-tab"
          legend="Show courses"
          value={tab}
          onChange={setTab}
          options={[
            { value: "enrolled", label: `My courses (${enrolled.length})` },
            { value: "available", label: `Electives (${available.length})` },
          ]}
        />
        {academic ? <p className="text-sm text-ink-muted">{academic}</p> : null}
      </div>
      <LiveRegion>{enroll.isSuccess ? "Enrolled. The course is now in your Enrolled list." : ""}</LiveRegion>

      {list.length === 0 ? (
        tab === "enrolled" ? (
          <EmptyState
            title="No courses assigned yet"
            description="Required courses appear automatically for your saved academic profile. You can also add available electives."
            action={<Button onClick={() => setTab("available")}>See electives</Button>}
          />
        ) : (
          <EmptyState title="No additional electives available" description="New required courses appear automatically in My courses when they are published." />
        )
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((o) => {
            const enrolling = enroll.isPending && enroll.variables?.offeringId === o.offering_id;
            const failed = enroll.isError && enroll.variables?.offeringId === o.offering_id;
            return (
              <li key={o.offering_id}>
                <CourseCard
                  offering={o}
                  academic={academic}
                  action={
                    o.enrolled ? (
                      <Button asChild block>
                        <Link href={`/study/courses/${o.offering_id}`}>
                          {o.lessons_completed > 0 ? "Continue" : "Start course"}
                          <span className="sr-only"> {o.course.code}</span>
                        </Link>
                      </Button>
                    ) : (
                      <div className="flex w-full flex-col gap-2">
                        <Button
                          block
                          variant="secondary"
                          loading={enrolling}
                          onClick={() => (failed ? enroll.retryLast() : enroll.mutate({ offeringId: o.offering_id }))}
                        >
                          <Plus className="size-4" aria-hidden /> {failed ? "Try again" : "Add elective"}
                          <span className="sr-only"> in {o.course.code}</span>
                        </Button>
                        {failed ? <InlineError error={enroll.error} /> : null}
                      </div>
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
