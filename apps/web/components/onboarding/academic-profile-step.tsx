"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProfile } from "@scholau/api/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { AcademicProfileForm } from "./academic-profile-form";
import { ChangeLimitNotice } from "./change-limit-notice";

export function AcademicProfileStep({ changeRequested }: { changeRequested: boolean }) {
  const router = useRouter();
  const profile = useProfile();
  const [completed, setCompleted] = useState(false);
  const academic = profile.data?.academic ?? null;
  const changeMode = changeRequested && academic !== null;
  const skip = !changeRequested && academic !== null && !completed;

  useEffect(() => {
    if (skip) router.replace("/onboarding/courses");
  }, [skip, router]);

  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
  if (profile.isPending || skip || completed) return <LoadingState label="Loading your profile…" />;

  const header = changeMode ? (
    <PageHeader eyebrow="Profile" title="Change academic details" description="Update the university details your courses are based on." />
  ) : (
    <PageHeader
      eyebrow={<span>Step 1 of 2 · Academic profile</span>}
      title="Tell us what you study"
      description="We use this to show the courses offered for your department, level and semester."
    />
  );

  if (changeMode && academic?.self_change_used_this_period) {
    return (
      <>
        {header}
        <ChangeLimitNotice />
        <Button asChild variant="outline" className="mt-6">
          <Link href="/profile">Back to profile</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      {header}
      <AcademicProfileForm
        profile={profile.data}
        changeMode={changeMode}
        onCompleted={() => {
          setCompleted(true);
          router.push(changeMode ? "/profile" : "/onboarding/courses");
        }}
      />
    </>
  );
}
