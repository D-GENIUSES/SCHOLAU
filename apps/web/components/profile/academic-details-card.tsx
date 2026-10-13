"use client";

import Link from "next/link";
import type { Profile } from "@scholau/api";
import { COPY, NIGERIAN_UNIVERSITIES, SEMESTER_LABELS, type RegistrationAcademicInput } from "@scholau/core";
import { ChangeLimitNotice } from "@/components/onboarding/change-limit-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function RequestChangeDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Request a change</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Change your academic details</DialogTitle>
        <DialogDescription>{COPY.academicChange}</DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button asChild>
            <Link href="/onboarding?change=1">Continue</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AcademicDetailsCard({ academic, registration = null }: { academic: Profile["academic"]; registration?: RegistrationAcademicInput | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Academic details</CardTitle>
      </CardHeader>
      <CardContent>
        {academic ? (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {[
              ["University", academic.university.name],
              ["Faculty", academic.faculty.name],
              ["Department", academic.department.name],
              ["Level", academic.level.label],
              ["Academic period", academic.academic_period.label],
              ["Semester", academic.semester.label],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-sm text-ink-muted">{k}</dt>
                <dd className="font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        ) : registration ? (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {[
              ["University", NIGERIAN_UNIVERSITIES.find((item) => item.value === registration.universitySlug)?.label],
              ["Faculty", registration.faculty],
              ["Department", registration.department],
              ["Current semester", SEMESTER_LABELS[registration.currentSemester]],
            ].map(([label, value]) => <div key={label} className="flex flex-col"><dt className="text-sm text-ink-muted">{label}</dt><dd className="font-semibold text-ink">{value}</dd></div>)}
          </dl>
        ) : (
          <p className="text-ink-muted">You haven&apos;t added your academic details yet.</p>
        )}
      </CardContent>
      <CardFooter>
        {!academic ? (
          <Button asChild>
            <Link href="/onboarding">{registration ? "Find courses" : "Add academic details"}</Link>
          </Button>
        ) : academic.self_change_used_this_period ? (
          <ChangeLimitNotice className="w-full" />
        ) : (
          <RequestChangeDialog />
        )}
      </CardFooter>
    </Card>
  );
}
